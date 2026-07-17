// ─────────────────────────────────────────────────────────────────────────
// Analytics — PostHog wiring (task-7 brief). `track(name, props)` stays the
// sole app-facing API (task 6), plus `setSuperProps(partial)` below for the
// small set of persistent event properties. PostHog itself loads lazily on
// first idle so it never sits in the entry bundle — every track() call
// before that load queues in memory (bounded) and flushes once init
// completes.
//
// Privacy: DNT is respected (navigator.doNotTrack === '1' → track() is a
// hard no-op and PostHog never loads) and no key → the dev console.debug
// stub from task 6 stays exactly as it was, in prod too. No call-site in
// this app ever puts the user's description text in an event — desc_length
// only. See .superpowers/sdd/briefs/task-7-brief.md for the full taxonomy.
//
// Privacy (review round 1, Finding 1): posthog-js also attaches
// $current_url/$pathname/$referrer (+ their $initial_*/$session_entry_*
// register_once'd, persisted twins) to EVERY captured event, regardless of
// `autocapture`. This app puts user free text and the encoded-coat share
// payload directly in the URL — the Studio autosave hash (/studio#<payload>,
// carries the motto), a /a/<payload> share pathname, and a transient
// ?desc=<text> query. See .superpowers/sdd/briefs/task-7-report.md's "Fix
// (review round 1)" section for the original incident + captured-payload
// evidence.
//
// Privacy (Hardening — allowlist inversion): the round-1 fix above was a
// DENYLIST of nine named URL-derived properties, and it was proven leaky by
// its own construction — $prev_pageview_pathname was only found by reading
// posthog-js source mid-verification, after the finding had already named
// six. A future posthog-js bump can add a tenth at any time and it would
// ship raw. `before_send` (see `sanitizeEvent` below) is now an ALLOWLIST:
// `SAFE_PROPS` names every property this app actually wants to leave the
// browser, and everything else is dropped — not rewritten — by construction.
// The nine URL/pathname/referrer properties are the one deliberate
// exception: instead of being dropped, they're rewritten to a sanitized
// form (origin + collapsed pathname; external-only referrer) because
// dashboards do rely on them. `$exception_list` gets the same treatment
// (stack frame filenames sanitized) since capture_exceptions:true means
// exception payloads flow through this same hook. See
// .superpowers/sdd/briefs/task-7-report.md's "Hardening (allowlist
// inversion)" section for the full SAFE_PROPS derivation.
// ─────────────────────────────────────────────────────────────────────────

import { onNavigate } from './router.js';

// `import.meta.env` itself is `undefined` under plain `node --test` (no Vite
// transform there) — optional-chain every read so the pure helpers below
// stay importable/testable outside a browser.
const KEY = import.meta.env?.VITE_POSTHOG_KEY;
const HOST = import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const DEV = !!import.meta.env?.DEV;
const QUEUE_LIMIT = 50;

const dnt = typeof navigator !== 'undefined' && navigator.doNotTrack === '1';
const hasKey = !!KEY;

// ── pure helpers — exported for direct unit testing, no browser needed ──

// Immutable, size-bounded push: keeps only the most recent `limit` items.
// (Used to hold events fired before PostHog has finished loading.)
export function _enqueue(items, item, limit = QUEUE_LIMIT) {
  const next = [...items, item];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

// The DNT / no-key / enabled gating decision as pure data, so the branching
// itself is unit-testable without touching import.meta.env or navigator.
export function _gateMode({ dnt: isDnt, hasKey: keyed }) {
  if (isDnt) return 'dnt';
  if (!keyed) return 'no_key';
  return 'enabled';
}

// ── URL/referrer sanitization for `before_send` ──────────────────────────
// posthog-js computes these from `location.href`/`document.referrer` itself
// (see node_modules/posthog-js/lib/src/utils/event-utils.js and
// session-props.js) and merges them into every event's properties — three
// families, each with a plain/"$initial_" (person, register_once'd forever)/
// "$session_entry_" (session-scoped) variant, all derived from the exact
// same underlying URL:
const URL_PROPS = ['$current_url', '$initial_current_url', '$session_entry_url'];
// $prev_pageview_pathname (posthog-js's own pageview-duration tracking —
// node_modules/posthog-js/lib/src/page-view.js) is attached to the pageview
// immediately AFTER a navigation and carries the PREVIOUS page's raw
// pathname — caught live during the round-1 verification (a /a/<payload> →
// /studio transition leaked the payload here even though $pathname itself
// was already clean on both events involved).
const PATH_PROPS = ['$pathname', '$initial_pathname', '$session_entry_pathname', '$prev_pageview_pathname'];
const REFERRER_PROPS = ['$referrer', '$initial_referrer', '$session_entry_referrer'];

// A pathname is already free of query/hash by definition — the one leak is
// /a/<payload>, which puts the encoded coat directly in the path. Collapse
// it; every other pathname (including /studio) passes through unchanged.
export function _sanitizePathname(pathname) {
  if (typeof pathname !== 'string') return pathname;
  return pathname.startsWith('/a/') ? '/a' : pathname;
}

// Rewrites a full URL string down to `origin + sanitizedPathname` — the
// query string and hash are dropped unconditionally (the Studio autosave
// hash and the ?desc= query are exactly where free text/payloads live).
// Unparseable input returns undefined so the caller drops the property
// entirely instead of risking a raw passthrough.
export function _sanitizeUrl(urlString) {
  if (typeof urlString !== 'string') return undefined;
  try {
    const u = new URL(urlString);
    return u.origin + _sanitizePathname(u.pathname);
  } catch {
    return undefined;
  }
}

// A same-origin referrer is itself one of our own URLs (potentially a
// previous /studio#<hash> or /a/<payload>) — drop it; an external referrer
// is useful attribution and carries none of our users' free text, so it's
// left untouched. `referrer` is posthog-js's own value, which is '$direct'
// (not a URL) when there was no referrer at all — left as-is.
export function _sanitizeReferrer(referrer, origin) {
  if (typeof referrer !== 'string' || !referrer) return referrer;
  try {
    const u = new URL(referrer);
    return origin && u.origin === origin ? undefined : referrer;
  } catch {
    return referrer;
  }
}

// Stack frame filenames inside $exception_list can, in principle, equal the
// page's own URL (some engines report inline/eval frames that way) — sanitize
// them the same way as $current_url, but never DROP a filename that isn't
// http(s)-URL-shaped ("<anonymous>", "webpack-internal://…", a bare relative
// path — `new URL()` happily parses some of these with a bogus/"null" origin,
// so an explicit protocol check is needed, not just try/catch): those carry
// no hash/query to strip and are useful debug info, so they pass through
// unchanged rather than being mangled or dropped the way a real
// unparseable $current_url would be.
export function _sanitizeExceptionFrameFilename(filename) {
  if (typeof filename !== 'string') return filename;
  try {
    const u = new URL(filename);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return filename;
    return u.origin + _sanitizePathname(u.pathname);
  } catch {
    return filename;
  }
}

// $exception_list (node_modules/@posthog/core/src/error-tracking/
// error-properties-builder.ts) is an array of
// `{ type, value, mechanism, stacktrace: { frames: [{ filename, ... }] } }`.
// Only `filename` can carry a URL; every other frame/exception field
// (function name, line/col, in_app, etc.) comes from parsing our own JS
// source and is left untouched. A malformed (non-array) shape is dropped
// entirely rather than passed through raw — same fail-toward-less-info
// stance as the rest of this file.
export function _sanitizeExceptionList(list) {
  if (!Array.isArray(list)) return undefined;
  return list.map((exc) => {
    if (!exc || typeof exc !== 'object') return exc;
    const next = { ...exc };
    const frames = next.stacktrace && next.stacktrace.frames;
    if (Array.isArray(frames)) {
      next.stacktrace = {
        ...next.stacktrace,
        frames: frames.map((f) =>
          f && typeof f === 'object' ? { ...f, filename: _sanitizeExceptionFrameFilename(f.filename) } : f
        ),
      };
    }
    return next;
  });
}

// ── SAFE_PROPS allowlist (Hardening: allowlist inversion) ────────────────
// Everything NOT named here — and not one of the URL/PATH/REFERRER/exception
// keys above, which are rewritten rather than dropped — is dropped from
// every outgoing event, unconditionally. This is the whole point: a denylist
// only catches properties someone thought to name; an allowlist catches
// every property nobody has named yet too.

// (a) Our own event props — the union of every prop key actually passed to
// `track(name, props)` anywhere in the app (grepped from every call-site in
// src/Studio.jsx, src/Landing.jsx, src/components/DownloadDialog.jsx —
// derived, not guessed; event names themselves need no allowlisting, only
// their prop keys do):
//   studio_opened{source} generate_submitted{desc_length,used_preset}
//   generate_result{outcome,latency_ms} design_edited{part,control,is_first_edit}
//   first_render{ms_since_submit} charge_search_used{query_len,hits,picked}
//   preset_selected{index} hero_interacted{control} download_opened{surface}
//   download_free{format} download_error{format}
//   (blazon_copied/describe_started/blazon_lang_toggled/landing_viewed/
//    print_interest_clicked/$pageview carry no props at all)
const OWN_EVENT_PROPS = [
  'source', 'desc_length', 'used_preset', 'outcome', 'latency_ms',
  'part', 'control', 'is_first_edit', 'ms_since_submit',
  'query_len', 'hits', 'picked', 'index', 'surface', 'format',
];

// (b) Our super-props — posthog.register()'d in _computeInitialSuperProps
// below and in App.jsx's ShareArrival — persisted onto every future event:
const SUPER_PROPS = ['has_library', 'designs_saved_count', 'has_purchased', 'arrived_via_share'];

// (c) posthog-js-internal properties that are genuinely safe — sourced from
// the UA string, screen, device/session/lib bookkeeping, or ingestion
// plumbing, NEVER from this app's URL/user-text surfaces — and that
// analytics needs to function or that dashboards rely on. Enumerated by
// reading node_modules/posthog-js/lib/src/utils/event-utils.js
// (getEventProperties/getPersonInfo), session-props.js, and
// posthog-core.js's calculateEventProperties, then cross-checked against a
// live capture (see task-7-report.md's "Hardening" section).
const POSTHOG_SAFE_PROPS = [
  // identity/session plumbing — `token` carries the project API key and is
  // REQUIRED for ingestion (posthog-js's own before_send contract logs a
  // warning and the event gets a 401 server-side without it — see
  // @posthog/core's knownUnsafeEditableEventProperty).
  'distinct_id', 'token', '$session_id', '$window_id', '$device_id', '$groups',
  '$is_identified', '$process_person_profile',
  // hostnames — domain only, structurally incapable of carrying a
  // path/query/hash, so nothing to sanitize.
  '$host', '$initial_host', '$session_entry_host',
  '$referring_domain', '$initial_referring_domain', '$session_entry_referring_domain',
  // device/browser/os — standard analytics dimensions, derived from the UA
  // string/screen, never from app content.
  '$os', '$os_name', '$os_version', '$browser', '$browser_version',
  '$browser_language', '$browser_language_prefix', '$device', '$device_type',
  '$screen_height', '$screen_width', '$viewport_height', '$viewport_width',
  '$raw_user_agent', '$timezone', '$timezone_offset',
  // lib/timing metadata.
  '$lib', '$lib_version', '$insert_id', '$time', 'timestamp',
  // exception structure (frame filenames are sanitized separately above via
  // the $exception_list special-case, not this plain allowlist).
  '$exception_level',
];

// Deliberately NOT included (checked, not guessed): UTM/click-id campaign
// params (utm_source, gclid, …) and $search_engine/ph_keyword — URL/referrer
// -derived and unused by this app's dashboards, so the allowlist default
// (drop) stands; `title` — document.title is static in this app (verified:
// no call-site ever assigns it) but isn't relied on by anything here either,
// so it's left off rather than added "just in case"; $config_defaults,
// $sdk_debug_*, $lib_rate_limit_remaining_tokens, $duration,
// $event_time_override_* — internal debug/feature knobs this app doesn't use.
// Exported (frozen) so tests can assert set membership directly rather than
// re-deriving the list — the schema itself is part of the contract.
export const SAFE_PROPS = Object.freeze(new Set([...OWN_EVENT_PROPS, ...SUPER_PROPS, ...POSTHOG_SAFE_PROPS]));

// Special-cased keys get a rewrite (sanitize-and-keep or origin-conditional
// keep) instead of a plain allowlist pass-through. Built once from the
// existing URL_PROPS/PATH_PROPS/REFERRER_PROPS arrays so the property lists
// stay the single source of truth.
const SPECIAL_KEY_HANDLERS = new Map([
  ...URL_PROPS.map((key) => [key, (value) => _sanitizeUrl(value)]),
  ...PATH_PROPS.map((key) => [key, (value) => _sanitizePathname(value)]),
  ...REFERRER_PROPS.map((key) => [key, (value, origin) => _sanitizeReferrer(value, origin)]),
  ['$exception_list', (value) => _sanitizeExceptionList(value)],
]);

// Applies the allowlist to one flat properties object (used for
// `event.properties`, and — see the $set_once note in sanitizeEvent below —
// `event.$set`/`event.$set_once` too, since posthog-js can populate those
// with the same $initial_* URL properties). A key with a special handler
// gets rewritten (dropped if the handler returns undefined); every other
// key survives only if it's in SAFE_PROPS; anything else is silently
// dropped — no logging per-key, that's the allowlist doing its job, not an
// error.
export function _sanitizeProps(properties, origin) {
  const out = {};
  for (const key of Object.keys(properties)) {
    const handler = SPECIAL_KEY_HANDLERS.get(key);
    if (handler) {
      const clean = handler(properties[key], origin);
      if (clean !== undefined) out[key] = clean;
      continue;
    }
    if (SAFE_PROPS.has(key)) out[key] = properties[key];
  }
  return out;
}

// In-memory, cheap-to-read counter of events dropped because sanitization
// itself threw (the fail-closed path below) — no I/O at drop time, mirrors
// this file's existing in-memory `queue` style. Reset via _resetForTests.
let sanitizeFailures = 0;
export function _sanitizeFailureCount() {
  return sanitizeFailures;
}

// The full `before_send` transform as pure data-in/data-out (posthog-js
// itself is not touched here) — `origin` is injected so this is testable
// without a real `window`/`location`. Returns a new event object; never
// mutates the one it's given.
//
// posthog-js's before_send contract: returning a nullish value drops the
// event entirely (see posthog-core.js's _runBeforeSend). That's also this
// function's FAIL-CLOSED path — if anything in the allowlist pass throws
// (a malformed property, a hostile getter, a future posthog-js shape this
// code doesn't anticipate), the event is dropped rather than risking a raw
// passthrough. The catch block never logs property VALUES, only the event
// name and property KEYS (plus which rule failed) — an error path must
// never become a second leak surface.
export function sanitizeEvent(event, origin) {
  if (!event) return event;
  try {
    const next = { ...event };
    if (event.properties && typeof event.properties === 'object') {
      next.properties = _sanitizeProps(event.properties, origin);
    }
    // posthog-js populates $set_once with $initial_current_url/
    // $initial_pathname/$initial_referrer (persistence.get_initial_props(),
    // see posthog-core.js's _calculate_set_once_properties) whenever person
    // processing is active — a second place the same URL properties can
    // surface, independent of `properties`. This app never calls identify()
    // today so it's unpopulated in practice, but the allowlist is applied
    // here defensively rather than assuming that stays true.
    if (event.$set_once && typeof event.$set_once === 'object') {
      next.$set_once = _sanitizeProps(event.$set_once, origin);
    }
    if (event.$set && typeof event.$set === 'object') {
      next.$set = _sanitizeProps(event.$set, origin);
    }
    return next;
  } catch (err) {
    sanitizeFailures += 1;
    if (DEV) {
      let keys = [];
      try {
        keys = event.properties && typeof event.properties === 'object' ? Object.keys(event.properties) : [];
      } catch { /* even key enumeration threw — log nothing further, still drop */ }
      // Deliberately never logs `err.message` — a hostile/broken getter could
      // construct an Error whose own message echoes the value it was hiding,
      // which would turn this diagnostic into exactly the leak it exists to
      // prevent. `err.name` (e.g. "TypeError") is a safe, valueless rule label.
      console.debug('[analytics] before_send threw — event dropped (fail-closed)', {
        event: typeof event.event === 'string' ? event.event : '(unknown)',
        propertyKeys: keys,
        rule: (err && err.name) || 'unknown_error',
      });
    }
    return null;
  }
}

// Initial super-prop snapshot read from storage — parsed defensively (bad or
// missing data just falls back to the defaults, never throws). `storage` is
// injectable so this is testable without real localStorage/sessionStorage.
export function _computeInitialSuperProps(storage = {}) {
  const ls = storage.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const ss = storage.sessionStorage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  const out = { has_library: false, designs_saved_count: 0, has_purchased: false, arrived_via_share: false };
  try {
    const raw = ls?.getItem('blazon:library:v1');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      out.designs_saved_count = parsed.length;
      out.has_library = parsed.length > 0;
    }
  } catch { /* corrupt/missing autosave — defaults stand */ }
  try {
    out.has_purchased = ls?.getItem('blazon:unlocks') != null;
  } catch { /* storage unavailable — default stands */ }
  try {
    out.arrived_via_share = ss?.getItem('blazon:arrived_via_share') === '1';
  } catch { /* storage unavailable — default stands */ }
  return out;
}

const mode = _gateMode({ dnt, hasKey });

let posthog = null;          // the loaded posthog-js module, once init resolves
let ready = false;           // posthog.init() has completed (successfully or not)
let scheduled = false;       // scheduleInit() already has a callback pending
let queue = [];              // events captured before `ready`
let pendingSuperProps = {};  // setSuperProps() calls captured before `ready`

async function init() {
  if (mode !== 'enabled' || ready) return;
  ready = true; // set before the await — a racing idle/timeout callback can't double-init
  try {
    const { default: ph } = await import('posthog-js');
    ph.init(KEY, {
      api_host: HOST,
      capture_exceptions: true,
      autocapture: false,
      person_profiles: 'identified_only',
      // We drive pageviews ourselves off the router (see onNavigate below) —
      // disable PostHog's own history-change tracking so it never double-fires.
      capture_pageview: false,
      // Allowlist every outgoing event — see `sanitizeEvent`/`SAFE_PROPS`
      // above for what/why. `before_send` runs on every capture() call
      // unconditionally (incl. $exception, since capture_exceptions:true
      // above, and $identify/autocapture-adjacent internals), so this is the
      // one chokepoint that covers all of them.
      before_send: (event) => sanitizeEvent(event, window.location.origin),
    });
    posthog = ph;
    if (Object.keys(pendingSuperProps).length) posthog.register(pendingSuperProps);
    queue.forEach(([name, props]) => posthog.capture(name, props));
    queue = [];
  } catch {
    // Script/network failure loading posthog-js — give up silently. Later
    // track() calls just keep queuing (bounded) since `posthog` stays null.
  }
}

function scheduleInit() {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => init());
  else setTimeout(() => init(), 2000);
}

/** Fire-and-forget event tracking — the sole app-facing entry point. */
export function track(name, props = {}) {
  if (mode === 'dnt') return; // hard no-op — never touch PostHog, never log
  if (mode === 'no_key') {
    if (DEV) console.debug('[track]', name, props);
    return;
  }
  if (posthog) posthog.capture(name, props);
  else queue = _enqueue(queue, [name, props]);
}

/** Register persistent event properties (posthog.register) — merges over
 *  whatever's already registered. No-op under DNT/no-key, same as track(). */
export function setSuperProps(partial) {
  if (mode !== 'enabled') return;
  if (posthog) posthog.register(partial);
  else pendingSuperProps = { ...pendingSuperProps, ...partial };
}

// Test-only: resets the mutable module state so a fresh scenario can be
// exercised without re-importing. `mode` itself (DNT/key gating) is fixed
// from the real env/navigator at module load and is deliberately not reset
// here — that piece is exercised via _gateMode directly instead.
export function _resetForTests() {
  posthog = null;
  ready = false;
  scheduled = false;
  queue = [];
  pendingSuperProps = {};
  sanitizeFailures = 0;
}

if (typeof window !== 'undefined' && mode !== 'dnt') {
  // Studio's autosave debounce also calls navigate() (replaceState, hash-only —
  // it writes the encoded design into the URL after every edit) — every one of
  // those goes through the same router notification as a real navigation. Gate
  // on the *pathname* actually changing so $pageview reflects genuine route
  // changes, not every settled edit re-saving its hash.
  let lastPath = window.location.pathname;
  const trackPageview = () => {
    const path = window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    track('$pageview');
  };

  track('$pageview'); // initial load; subsequent route changes via onNavigate below
  onNavigate(trackPageview);
  if (mode === 'enabled') {
    setSuperProps(_computeInitialSuperProps());
    scheduleInit();
  }
}

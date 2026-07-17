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
// ?desc=<text> query — so those properties are sanitized via `before_send`
// (see `_sanitizeEventForPostHog` below) before any event leaves the
// browser. See .superpowers/sdd/briefs/task-7-report.md's "Fix (review
// round 1)" section for the full design + captured-payload evidence.
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

// ── URL/referrer sanitization for `before_send` (Finding 1, review round 1) ──
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
// pathname — caught live during verification (a /a/<payload> → /studio
// transition leaked the payload here even though $pathname itself was
// already clean on both events involved).
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

// The full `before_send` transform as pure data-in/data-out (posthog-js
// itself is not touched here) — `origin` is injected so this is testable
// without a real `window`/`location`. Returns a new event object; never
// mutates the one it's given.
export function _sanitizeEventForPostHog(event, origin) {
  if (!event || !event.properties) return event;
  const properties = { ...event.properties };
  for (const key of URL_PROPS) {
    if (key in properties) {
      const clean = _sanitizeUrl(properties[key]);
      if (clean === undefined) delete properties[key];
      else properties[key] = clean;
    }
  }
  for (const key of PATH_PROPS) {
    if (key in properties) properties[key] = _sanitizePathname(properties[key]);
  }
  for (const key of REFERRER_PROPS) {
    if (key in properties) {
      const clean = _sanitizeReferrer(properties[key], origin);
      if (clean === undefined) delete properties[key];
      else properties[key] = clean;
    }
  }
  return { ...event, properties };
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
      // Finding 1 (review round 1): sanitize the URL-derived properties
      // posthog-js attaches automatically to every event — see
      // _sanitizeEventForPostHog above for what/why. `before_send` runs on
      // every capture() call unconditionally (incl. $exception, since
      // capture_exceptions:true above), so this is the one place that
      // covers all of them.
      before_send: (event) => _sanitizeEventForPostHog(event, window.location.origin),
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

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

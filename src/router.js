// ─────────────────────────────────────────────────────────────────────────
// Hand-rolled client router — no dependencies. The app has 4 routes; that
// doesn't need react-router. `navigate()` drives pushState/replaceState and
// notifies subscribers directly (pushState/replaceState don't fire
// `popstate` themselves); `useRoute()` subscribes a component to both that
// and real back/forward navigation.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

const subscribers = new Set();

// ── pure parsing helpers (no DOM — testable under plain `node --test`) ──

// "?a=1&b=2" (leading '?' optional) → { a: '1', b: '2' }. Delegates to the
// platform URLSearchParams (global in browsers, Workers, and Node ≥18) for
// %-decoding and '+'-as-space form semantics.
export function parseQuery(search) {
  const out = {};
  new URLSearchParams(search || '').forEach((v, k) => { out[k] = v; });
  return out;
}

// "#foo" or "foo" → "foo"; "" / undefined → "".
export function parseHash(hash) {
  return hash && hash[0] === '#' ? hash.slice(1) : (hash || '');
}

function currentLocation() {
  if (typeof window === 'undefined') return { path: '/', hash: '', query: {} };
  return {
    path: window.location.pathname,
    hash: parseHash(window.location.hash),
    query: parseQuery(window.location.search),
  };
}

function notify() {
  const loc = currentLocation();
  subscribers.forEach((setLoc) => setLoc(loc));
}

if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

// Update the URL — pushState by default (a normal user navigation), or
// replaceState with {replace: true} (redirects, per-edit autosave — never
// spam history) — then notify every mounted useRoute().
// `path` is a full path, optionally carrying its own hash/query (e.g.
// '/studio#<payload>').
export function navigate(path, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  notify();
}

// Current location as { path, hash, query }, re-rendering the caller on any
// navigation (back/forward or navigate()). SSR-safe: components rendered
// server-side (renderToStaticMarkup) may sit under the router with no
// `window` — return the static default instead of throwing.
export function useRoute() {
  const [loc, setLoc] = useState(currentLocation);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    subscribers.add(setLoc);
    return () => subscribers.delete(setLoc);
  }, []);
  return loc;
}

// Non-hook subscription for consumers that aren't React components (task-7
// brief §1 — analytics' `$pageview` wiring). `notify()` already treats every
// subscriber as a plain `(loc) => void` callback — useRoute's `setLoc` just
// happens to be one — so a bare callback subscribes the same way a
// component does, no separate notification path needed. Returns an
// unsubscribe function.
export function onNavigate(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

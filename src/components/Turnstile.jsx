import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Cloudflare Turnstile widget — invisible until Cloudflare actually needs an
// interactive challenge (task-15 brief §2). Two widget options do the work:
//   appearance: 'interaction-only' — the widget occupies no visible space
//     unless a real challenge is required; the common (non-interactive) pass
//     never shows the user anything.
//   execution: 'execute' — the widget renders on mount but does NOT start
//     verifying until something calls the imperative execute() below. No
//     auto-run-on-mount checkbox flash before the user has asked for anything.
// Exposes execute() (Promise<token|null>, one-shot) for the describe-submit
// flow to await at click time, and reset() so the caller can refresh the
// single-use token for the next attempt.
//
// Site key is public. Use the real key from VITE_TURNSTILE_SITE_KEY in prod; in
// dev only, fall back to Cloudflare's always-pass TEST key so local works with
// no setup. In prod with no key configured we render nothing (→ execute()
// resolves null → the server fail-safe blocks generation and the client uses
// its preset fallback).
const TEST_SITE_KEY = '1x00000000000000000000AA';
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : '');

// Whether a widget will actually render. Callers use this to distinguish a
// real failed challenge from the toxic half-config (server secret set, no
// client site key → no widget → token always null → every generate would
// otherwise look like a failed verification with nothing to complete).
export const turnstileConfigured = !!SITE_KEY;

let scriptPromise;
function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

const Turnstile = forwardRef(function Turnstile(_props, ref) {
  const elRef = useRef(null);
  const idRef = useRef(null);
  const pendingRef = useRef(null); // resolve() of the in-flight execute() call, if any

  const settle = (token) => {
    if (pendingRef.current) {
      const resolve = pendingRef.current;
      pendingRef.current = null;
      resolve(token);
    }
  };

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && idRef.current != null) {
        try { window.turnstile.reset(idRef.current); } catch { /* ignore */ }
      }
    },
    // Not configured, or the script/widget hasn't finished rendering yet →
    // resolve null (same fail-safe as before: a missing token reads server-
    // side as an unconfigured/failed challenge, never a hang).
    execute() {
      return new Promise((resolve) => {
        if (!SITE_KEY || !window.turnstile || idRef.current == null) {
          resolve(null);
          return;
        }
        pendingRef.current = resolve;
        try {
          window.turnstile.execute(idRef.current);
        } catch {
          settle(null);
        }
      });
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return undefined; // not configured → render nothing
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !elRef.current || !window.turnstile) return;
      idRef.current = window.turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        appearance: 'interaction-only', // invisible unless a real challenge is required
        execution: 'execute',           // wait for execute() — no auto-run on mount
        callback: (token) => settle(token),
        'error-callback': () => settle(null),
        'expired-callback': () => settle(null),
        'timeout-callback': () => settle(null),
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (window.turnstile && idRef.current != null) {
        try { window.turnstile.remove(idRef.current); } catch { /* ignore */ }
      }
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={elRef} style={{ marginTop: 14 }} />;
});

export default Turnstile;

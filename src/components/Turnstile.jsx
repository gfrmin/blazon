import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Cloudflare Turnstile widget (explicit render). Yields a one-shot token via
// onToken; expose reset() so the caller can refresh it after each use.
//
// Site key is public. Use the real key from VITE_TURNSTILE_SITE_KEY in prod; in
// dev only, fall back to Cloudflare's always-pass TEST key so local works with
// no setup. In prod with no key configured we render nothing (→ no token → the
// server fail-safe blocks generation and the client uses its preset fallback).
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

const Turnstile = forwardRef(function Turnstile({ onToken }, ref) {
  const elRef = useRef(null);
  const idRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && idRef.current != null) {
        try { window.turnstile.reset(idRef.current); } catch { /* ignore */ }
      }
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return undefined; // not configured → render nothing
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !elRef.current || !window.turnstile) return;
      idRef.current = window.turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null),
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

// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — POST /api/verify-payment
//
// The Studio `?cs=<session_id>` return leg calls this after a Stripe
// Checkout redirect. Retrieves the session from Stripe (raw REST — see
// functions/_lib/stripe.js), confirms it's actually paid, and mints an
// unlock token (functions/_lib/unlock.js, WebCrypto HMAC) bound to the
// designHash Stripe's own metadata carries (set at /api/checkout time —
// never re-derived from client input here, so a tampered client can't mint
// a token for a design it didn't pay for).
//
// Idempotent by construction: sign() (functions/_lib/unlock.js) is a pure
// function of (secret, designHash) — replaying the SAME session_id (same
// Stripe-side metadata.designHash) re-mints the IDENTICAL token, never a
// second grant. The KV audit write below is a best-effort record only (never
// gates the response) — PURCHASES absent/unavailable degrades to "no audit
// trail", not "no unlock" (webhookless-by-design: this endpoint's response
// value IS the state, not a cache of it).
//
// Fail-safe: missing STRIPE_SECRET_KEY or UNLOCK_SIGNING_SECRET → 503
// `checkout_not_configured` (same shape /api/checkout uses) — never mints a
// token off a half-configured deploy.
// ─────────────────────────────────────────────────────────────────────────

import { json } from '../_lib/http.js';
import { stripeGet } from '../_lib/stripe.js';
import { sign } from '../_lib/unlock.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY || !env.UNLOCK_SIGNING_SECRET) {
    return json({ error: 'checkout_not_configured' }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!sessionId) return json({ error: 'missing_session_id' }, 400);

  const { ok, data } = await stripeGet(env.STRIPE_SECRET_KEY, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!ok || !data) return json({ error: 'unknown_session' }, 404);

  const hash = data.metadata && data.metadata.designHash;
  const paid = data.status === 'complete' && data.payment_status === 'paid' && !!hash;

  if (!paid) {
    return json({ paid: false, status: data.status || 'unknown' }, 402);
  }

  const token = await sign(env.UNLOCK_SIGNING_SECRET, hash);

  // Best-effort, idempotent audit — never blocks or alters the response.
  if (env.PURCHASES) {
    try {
      const auditKey = `purchase:${sessionId}`;
      const existing = await env.PURCHASES.get(auditKey);
      if (!existing) {
        await env.PURCHASES.put(auditKey, JSON.stringify({ designHash: hash, at: Date.now() }));
      }
    } catch { /* KV unavailable — the unlock itself still succeeds */ }
  }

  return json({ paid: true, token, designHash: hash });
}

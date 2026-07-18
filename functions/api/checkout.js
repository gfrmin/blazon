// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — POST /api/checkout
//
// Creates a Stripe Checkout Session (raw REST, zero-dep — see
// functions/_lib/stripe.js) for the $19 "own it — print files" unlock.
// `payload` is the SAME encoded-coat payload src/share/codec.js already
// produces for share links (`{v:1, coat}` → deflate-raw → base64url) — the
// client sends its current design exactly as it would for a share URL.
//
// Fail-safe (task-19 brief, verbatim; extended post-review to close a
// charge-without-delivery gap): missing STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
// OR UNLOCK_SIGNING_SECRET → 503 `checkout_not_configured`, checked BEFORE
// touching the request body so a misconfigured deploy always reports the
// same thing regardless of payload shape. UNLOCK_SIGNING_SECRET is included
// here even though this handler never uses it directly — /api/verify-payment
// requires it to mint an unlock token on the `?cs=` return leg, so a Checkout
// Session must never be created if that later step can't possibly succeed
// (Stripe-configured-but-signing-secret-missing would otherwise charge the
// customer and then 503 on return, with no unlock delivered). The client
// keeps the free tier intact and shows "coming soon" for the paid slot —
// NEVER a dead $19 button (the funnel poison M1 removed).
//
// designHash is computed from the DECODED, NORMALIZED coat — decodeCoat()
// (src/share/codec.js) already throws on anything that fails to normalize,
// so an un-normalizable payload never reaches designHash() at all (a raw,
// un-normalized coat hashes to a constant — see progress.md's Task 3 review
// note — decodeCoat's own normalize() call is what closes that off).
// ─────────────────────────────────────────────────────────────────────────

import { json } from '../_lib/http.js';
import { checkRates } from '../_lib/ratelimit.js';
import { stripePost } from '../_lib/stripe.js';
import { decodeCoat, designHash } from '../../src/share/codec.js';

const PER_IP_PER_MIN = 5;
const PER_IP_PER_DAY = 20;

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (env.RATE) {
    const { ok } = await checkRates(env.RATE, [
      { baseKey: `checkout:ip:${ip}:min`, limit: PER_IP_PER_MIN, windowSec: 60 },
      { baseKey: `checkout:ip:${ip}:day`, limit: PER_IP_PER_DAY, windowSec: 86400 },
    ]);
    if (!ok) return json({ error: 'rate_limited' }, 429);
  }

  // Fail-safe FIRST — see file header. Checked before parsing the body.
  // Same three vars /api/verify-payment requires — a session this deploy
  // couldn't later verify/unlock must never be created.
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.UNLOCK_SIGNING_SECRET) {
    return json({ error: 'checkout_not_configured' }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch { /* ignore — falls through to bad_payload below */ }

  const payload = typeof body.payload === 'string' ? body.payload : '';
  let coat;
  try {
    coat = await decodeCoat(payload);
  } catch {
    return json({ error: 'bad_payload' }, 400);
  }

  const hash = await designHash(coat);
  const origin = new URL(request.url).origin;

  const { ok, data } = await stripePost(env.STRIPE_SECRET_KEY, '/checkout/sessions', [
    ['mode', 'payment'],
    ['line_items[0][price]', env.STRIPE_PRICE_ID],
    ['line_items[0][quantity]', '1'],
    // Card-only — deliberate (task-19 brief §2): async payment methods
    // (bank redirects, etc.) come back from Stripe UNPAID at redirect time,
    // which would break the webhookless success-return verify flow below
    // (/api/verify-payment expects `payment_status === 'paid'` immediately).
    ['payment_method_types[0]', 'card'],
    ['metadata[designHash]', hash],
    ['metadata[v]', '1'],
    // {CHECKOUT_SESSION_ID} is a literal Stripe template token — substituted
    // server-side by Stripe itself on redirect, not URL-encoded here.
    ['success_url', `${origin}/studio?cs={CHECKOUT_SESSION_ID}#${payload}`],
    ['cancel_url', `${origin}/studio#${payload}`],
  ]);

  if (!ok || !data || !data.url) return json({ error: 'stripe_error' }, 502);
  return json({ url: data.url });
}

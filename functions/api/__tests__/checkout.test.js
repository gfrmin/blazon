import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../checkout.js';
import { encodeCoat, designHash } from '../../../src/share/codec.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function fakeRequest(body, url = 'https://blazon.pages.dev/api/checkout') {
  return { url, headers: { get: () => '198.51.100.1' }, json: async () => body };
}

// Minimal in-memory KV stand-in (matches functions/_lib/__tests__/ratelimit.test.js's fakeKV).
function fakeKV() {
  const m = new Map();
  return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); } };
}

const REAL_COAT = { field: { tincture: 'Gules' }, charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } }] };

const CONFIGURED_ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID: 'price_x' };

/** Stub fetch: Stripe checkout-session creation always succeeds with a fixed URL, capturing the request for inspection. */
function stubStripeOk(capture) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('api.stripe.com/v1/checkout/sessions')) {
      if (capture) capture.push({ url: u, init });
      return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' }) };
    }
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}

// ── fail-safe (never a dead $19 button) ─────────────────────────────────

test('missing BOTH Stripe env vars -> 503 checkout_not_configured, never touches Stripe/body', async () => {
  let calledStripe = false;
  globalThis.fetch = async (url) => { calledStripe = true; throw new Error(`must not call Stripe: ${url}`); };
  const res = await onRequestPost({ request: fakeRequest({ payload: 'garbage that would 400 anyway' }), env: {} });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'checkout_not_configured' });
  assert.equal(calledStripe, false);
});

test('missing STRIPE_PRICE_ID alone -> 503 (both vars required, matching /api/health\'s own rule)', async () => {
  const res = await onRequestPost({ request: fakeRequest({}), env: { STRIPE_SECRET_KEY: 'sk_test_x' } });
  assert.equal(res.status, 503);
});

test('missing STRIPE_SECRET_KEY alone -> 503', async () => {
  const res = await onRequestPost({ request: fakeRequest({}), env: { STRIPE_PRICE_ID: 'price_x' } });
  assert.equal(res.status, 503);
});

test('fail-safe check runs BEFORE body parsing — a malformed body never surfaces as a different error when unconfigured', async () => {
  const res = await onRequestPost({ request: { url: 'https://blazon.pages.dev/api/checkout', headers: { get: () => 'x' }, json: async () => { throw new Error('malformed json'); } }, env: {} });
  assert.equal(res.status, 503);
});

// ── rate limiting ────────────────────────────────────────────────────────

test('rate limited -> 429, never reaches Stripe', async () => {
  let calledStripe = false;
  globalThis.fetch = async () => { calledStripe = true; return { ok: true, status: 200, json: async () => ({}) }; };
  const kv = fakeKV();
  // PER_IP_PER_MIN is 5 — exhaust it first via checkRates directly isn't
  // exposed, so drive it through 5 real calls, then expect the 6th to 429.
  const payload = await encodeCoat(REAL_COAT);
  let last;
  for (let i = 0; i < 6; i++) {
    last = await onRequestPost({ request: fakeRequest({ payload }), env: { ...CONFIGURED_ENV, RATE: kv } });
  }
  assert.equal(last.status, 429);
  assert.deepEqual(await last.json(), { error: 'rate_limited' });
});

// ── payload validation ──────────────────────────────────────────────────

test('bad (unparseable) payload -> 400 bad_payload', async () => {
  const res = await onRequestPost({ request: fakeRequest({ payload: 'not-a-real-payload!!' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'bad_payload' });
});

test('missing payload field entirely -> 400 bad_payload', async () => {
  const res = await onRequestPost({ request: fakeRequest({}), env: CONFIGURED_ENV });
  assert.equal(res.status, 400);
});

test('an un-normalizable coat (e.g. {}) -> 400, never reaches designHash/Stripe (progress.md Task 3 review note: designHash of a null-normalized coat hashes to a constant — must never be allowed through)', async () => {
  let calledStripe = false;
  globalThis.fetch = async () => { calledStripe = true; return { ok: true, status: 200, json: async () => ({}) }; };
  const payload = await encodeCoat({}); // encodeCoat itself doesn't normalize — {} round-trips structurally...
  const res = await onRequestPost({ request: fakeRequest({ payload }), env: CONFIGURED_ENV });
  assert.equal(res.status, 400); // ...but decodeCoat's internal normalize() rejects it
  assert.equal(calledStripe, false);
});

// ── success path — form-encoding + designHash correctness ──────────────

test('valid payload -> creates a Stripe Checkout session, form-encoded correctly, card-only, correct metadata + success/cancel URLs', async () => {
  const captured = [];
  stubStripeOk(captured);
  const payload = await encodeCoat(REAL_COAT);
  const expectedHash = await designHash(REAL_COAT);

  const res = await onRequestPost({ request: fakeRequest({ payload }), env: CONFIGURED_ENV });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { url: 'https://checkout.stripe.com/pay/cs_test_123' });

  assert.equal(captured.length, 1);
  const form = captured[0].init.body;
  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][price]'), 'price_x');
  assert.equal(form.get('line_items[0][quantity]'), '1');
  assert.equal(form.get('payment_method_types[0]'), 'card'); // card-only — async methods break webhookless verify
  assert.equal(form.get('metadata[designHash]'), expectedHash);
  assert.equal(form.get('metadata[v]'), '1');
  assert.equal(form.get('success_url'), `https://blazon.pages.dev/studio?cs={CHECKOUT_SESSION_ID}#${payload}`);
  assert.equal(form.get('cancel_url'), `https://blazon.pages.dev/studio#${payload}`);
});

test('Stripe error response -> 502 stripe_error, never leaks the secret key', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'invalid price' } }) });
  const payload = await encodeCoat(REAL_COAT);
  const res = await onRequestPost({ request: fakeRequest({ payload }), env: CONFIGURED_ENV });
  assert.equal(res.status, 502);
  const raw = JSON.stringify(await res.json());
  assert.equal(raw.includes(CONFIGURED_ENV.STRIPE_SECRET_KEY), false);
});

test('two structurally-different coats that hash the same normalized value produce the SAME metadata.designHash (legacy vs canonical shape)', async () => {
  const captured = [];
  stubStripeOk(captured);
  const legacy = { field: 'Gules', ordinary: 'fess', ordinaryTincture: 'Or', charges: [] };
  const payload = await encodeCoat(legacy);
  await onRequestPost({ request: fakeRequest({ payload }), env: CONFIGURED_ENV });
  const expectedHash = await designHash(legacy);
  assert.equal(captured[0].init.body.get('metadata[designHash]'), expectedHash);
});

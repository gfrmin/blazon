import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from '../verify-payment.js';
import { sign } from '../../_lib/unlock.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function fakeRequest(body) {
  return { headers: { get: () => 'x' }, json: async () => body };
}

function fakeKV() {
  const m = new Map();
  return {
    puts: [],
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); this.puts.push(k); },
  };
}

const CONFIGURED_ENV = { STRIPE_SECRET_KEY: 'sk_test_x', UNLOCK_SIGNING_SECRET: 'unlock-secret-do-not-use-in-prod' };
const HASH = 'c'.repeat(64);

function stubStripeSession(session) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith('https://api.stripe.com/v1/checkout/sessions/')) {
      return { ok: true, status: 200, json: async () => session };
    }
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}

// ── fail-safe ────────────────────────────────────────────────────────────

test('missing STRIPE_SECRET_KEY -> 503, never calls Stripe', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; };
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: { UNLOCK_SIGNING_SECRET: 'x' } });
  assert.equal(res.status, 503);
  assert.equal(called, false);
});

test('missing UNLOCK_SIGNING_SECRET -> 503, never mints a token off a half-configured deploy', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; };
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: { STRIPE_SECRET_KEY: 'sk_test_x' } });
  assert.equal(res.status, 503);
  assert.equal(called, false);
});

// ── input validation ─────────────────────────────────────────────────────

test('missing/blank session_id -> 400', async () => {
  const res1 = await onRequestPost({ request: fakeRequest({}), env: CONFIGURED_ENV });
  assert.equal(res1.status, 400);
  const res2 = await onRequestPost({ request: fakeRequest({ session_id: '   ' }), env: CONFIGURED_ENV });
  assert.equal(res2.status, 400);
});

// ── unknown / unpaid / paid branches ─────────────────────────────────────

test('unknown session (Stripe 404s) -> 404 unknown_session', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'No such session' } }) });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_missing' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 404);
});

test('session exists but not paid (open/incomplete) -> 402 {paid:false, status}', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'open', payment_status: 'unpaid', metadata: { designHash: HASH } });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 402);
  assert.deepEqual(await res.json(), { paid: false, status: 'open' });
});

test('session complete but payment_status not "paid" (e.g. an async method still settling) -> 402', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'unpaid', metadata: { designHash: HASH } });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 402);
});

test('session paid but missing metadata.designHash -> 402 (never mints a token with no design to bind it to)', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: {} });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 402);
});

test('paid session -> 200 {paid:true, token, designHash}; token matches sign(secret, designHash) exactly', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: { designHash: HASH, v: '1' } });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.paid, true);
  assert.equal(body.designHash, HASH);
  const expected = await sign(CONFIGURED_ENV.UNLOCK_SIGNING_SECRET, HASH);
  assert.equal(body.token, expected);
});

// ── idempotent KV audit ───────────────────────────────────────────────────

test('idempotent: replaying the SAME session_id mints the IDENTICAL token, and writes the KV audit record only ONCE', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: { designHash: HASH } });
  const kv = fakeKV();
  const res1 = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: { ...CONFIGURED_ENV, PURCHASES: kv } });
  const res2 = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: { ...CONFIGURED_ENV, PURCHASES: kv } });
  const body1 = await res1.json();
  const body2 = await res2.json();
  assert.equal(body1.token, body2.token, 'replaying the same session must re-mint the SAME token, never a fresh one');
  assert.equal(kv.puts.length, 1, 'the audit record must be written exactly once, not once per verify call');
  assert.equal(kv.puts[0], 'purchase:cs_test_1');
});

test('two DIFFERENT session_ids for the SAME designHash both succeed independently (two separate purchases of the same design are not conflated)', async () => {
  const kv = fakeKV();
  globalThis.fetch = async (url) => {
    const u = String(url);
    const id = u.split('/').pop();
    return { ok: true, status: 200, json: async () => ({ id, status: 'complete', payment_status: 'paid', metadata: { designHash: HASH } }) };
  };
  await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_a' }), env: { ...CONFIGURED_ENV, PURCHASES: kv } });
  await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_b' }), env: { ...CONFIGURED_ENV, PURCHASES: kv } });
  assert.deepEqual(kv.puts, ['purchase:cs_test_a', 'purchase:cs_test_b']);
});

test('PURCHASES KV absent -> unlock still succeeds (audit is best-effort, never a gate)', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: { designHash: HASH } });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).paid, true);
});

test('PURCHASES KV.put throws -> unlock still succeeds (fail-safe: audit failure never blocks the response)', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: { designHash: HASH } });
  const throwingKV = { async get() { return null; }, async put() { throw new Error('KV unavailable'); } };
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: { ...CONFIGURED_ENV, PURCHASES: throwingKV } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).paid, true);
});

test('never leaks STRIPE_SECRET_KEY or UNLOCK_SIGNING_SECRET in any response body', async () => {
  stubStripeSession({ id: 'cs_test_1', status: 'complete', payment_status: 'paid', metadata: { designHash: HASH } });
  const res = await onRequestPost({ request: fakeRequest({ session_id: 'cs_test_1' }), env: CONFIGURED_ENV });
  const raw = JSON.stringify(await res.json());
  assert.equal(raw.includes(CONFIGURED_ENV.STRIPE_SECRET_KEY), false);
  assert.equal(raw.includes(CONFIGURED_ENV.UNLOCK_SIGNING_SECRET), false);
});

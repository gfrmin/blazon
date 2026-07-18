import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from '../health.js';

test('all env vars absent → all false', async () => {
  const res = await onRequestGet({ env: {} });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(body, { generate: false, turnstile: false, checkout: false });
});

test('all env vars present → all true, values never echoed', async () => {
  const env = {
    ANTHROPIC_API_KEY: 'sk-secret-anthropic',
    TURNSTILE_SECRET_KEY: 'secret-turnstile',
    STRIPE_SECRET_KEY: 'sk-secret-stripe',
    STRIPE_PRICE_ID: 'price_123',
    UNLOCK_SIGNING_SECRET: 'unlock-secret-x',
  };
  const res = await onRequestGet({ env });
  const body = await res.json();
  assert.deepEqual(body, { generate: true, turnstile: true, checkout: true });
  const raw = JSON.stringify(body);
  for (const secretValue of Object.values(env)) {
    assert.equal(raw.includes(secretValue), false, `body must not leak ${secretValue}`);
  }
});

test('checkout requires all THREE vars (STRIPE_SECRET_KEY, STRIPE_PRICE_ID, UNLOCK_SIGNING_SECRET) — any one alone is false', async () => {
  assert.equal(
    (await (await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk-x' } })).json()).checkout,
    false,
  );
  assert.equal(
    (await (await onRequestGet({ env: { STRIPE_PRICE_ID: 'price_x' } })).json()).checkout,
    false,
  );
  assert.equal(
    (await (await onRequestGet({ env: { UNLOCK_SIGNING_SECRET: 'unlock-x' } })).json()).checkout,
    false,
  );
});

// Real-money regression lock (review finding): the two Stripe vars alone are
// NOT sufficient — verify-payment.js also requires UNLOCK_SIGNING_SECRET to
// mint an unlock token, so a deploy missing only that var must still report
// checkout:false. Otherwise DownloadDialog shows a live $19 button whose
// `?cs=` return leg always 503s: charged, never unlocked.
test('checkout is false when BOTH Stripe vars are present but UNLOCK_SIGNING_SECRET is absent (charge-without-delivery half-config)', async () => {
  const body = await (await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk-x', STRIPE_PRICE_ID: 'price_x' } })).json();
  assert.equal(body.checkout, false);
});

test('checkout is true only when all three vars are present together', async () => {
  const body = await (await onRequestGet({
    env: { STRIPE_SECRET_KEY: 'sk-x', STRIPE_PRICE_ID: 'price_x', UNLOCK_SIGNING_SECRET: 'unlock-x' },
  })).json();
  assert.equal(body.checkout, true);
});

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
  };
  const res = await onRequestGet({ env });
  const body = await res.json();
  assert.deepEqual(body, { generate: true, turnstile: true, checkout: true });
  const raw = JSON.stringify(body);
  for (const secretValue of Object.values(env)) {
    assert.equal(raw.includes(secretValue), false, `body must not leak ${secretValue}`);
  }
});

test('checkout requires both Stripe vars — either alone is false', async () => {
  assert.equal(
    (await (await onRequestGet({ env: { STRIPE_SECRET_KEY: 'sk-x' } })).json()).checkout,
    false,
  );
  assert.equal(
    (await (await onRequestGet({ env: { STRIPE_PRICE_ID: 'price_x' } })).json()).checkout,
    false,
  );
});

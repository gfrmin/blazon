import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripePost, stripeGet } from '../stripe.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('stripePost: form-encodes entries (incl. bracket-notation keys), never JSON — Stripe requires form-encoding', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/x' }) };
  };
  const { ok, status, data } = await stripePost('sk_test_x', '/checkout/sessions', [
    ['mode', 'payment'],
    ['line_items[0][price]', 'price_abc'],
    ['line_items[0][quantity]', '1'],
    ['metadata[designHash]', 'deadbeef'],
  ]);

  assert.equal(ok, true);
  assert.equal(status, 200);
  assert.deepEqual(data, { id: 'cs_test_123', url: 'https://checkout.stripe.com/x' });

  assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers['content-type'], 'application/x-www-form-urlencoded');

  const body = captured.init.body;
  assert.ok(body instanceof URLSearchParams);
  assert.equal(body.get('mode'), 'payment');
  assert.equal(body.get('line_items[0][price]'), 'price_abc');
  assert.equal(body.get('line_items[0][quantity]'), '1');
  assert.equal(body.get('metadata[designHash]'), 'deadbeef');
});

test('stripePost: authenticates via HTTP Basic with the secret key as username, empty password — never a bearer token, never in the body', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = init;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await stripePost('sk_test_SECRETVALUE', '/checkout/sessions', [['mode', 'payment']]);
  const expected = 'Basic ' + btoa('sk_test_SECRETVALUE:');
  assert.equal(captured.headers.authorization, expected);
  // The secret must never appear in the form body itself.
  assert.equal([...captured.body.keys()].includes('sk_test_SECRETVALUE'), false);
});

test('stripePost: drops undefined/null entries rather than sending the literal string "undefined"', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => { captured = init; return { ok: true, status: 200, json: async () => ({}) }; };
  await stripePost('sk_test_x', '/checkout/sessions', [
    ['mode', 'payment'],
    ['metadata[v]', undefined],
    ['cancel_url', null],
  ]);
  assert.equal(captured.body.has('metadata[v]'), false);
  assert.equal(captured.body.has('cancel_url'), false);
});

test('stripePost: ok:false + status passed through on a non-2xx Stripe response, body still parsed', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'card_declined' } }) });
  const { ok, status, data } = await stripePost('sk_test_x', '/checkout/sessions', [['mode', 'payment']]);
  assert.equal(ok, false);
  assert.equal(status, 402);
  assert.equal(data.error.message, 'card_declined');
});

test('stripePost: an unparseable response body resolves data:null rather than throwing', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
  const { ok, data } = await stripePost('sk_test_x', '/checkout/sessions', [['mode', 'payment']]);
  assert.equal(ok, true);
  assert.equal(data, null);
});

test('stripeGet: GET with Basic auth, no body', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return { ok: true, status: 200, json: async () => ({ id: 'cs_test_123', status: 'complete', payment_status: 'paid' }) };
  };
  const { ok, data } = await stripeGet('sk_test_x', '/checkout/sessions/cs_test_123');
  assert.equal(ok, true);
  assert.equal(data.status, 'complete');
  assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_123');
  assert.equal(captured.init.method, undefined); // fetch defaults to GET when unspecified
  assert.equal(captured.init.headers.authorization, 'Basic ' + btoa('sk_test_x:'));
  assert.equal(captured.init.body, undefined);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRate, checkRates } from '../ratelimit.js';

// Minimal in-memory KV stand-in (ignores TTL).
function fakeKV() {
  const m = new Map();
  return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); } };
}

test('checkRate allows up to the limit, then blocks within the window', async () => {
  const kv = fakeKV();
  const opts = { limit: 3, windowSec: 60, now: 1_000_000 };
  for (let i = 0; i < 3; i++) {
    const r = await checkRate(kv, 'ip:x', opts);
    assert.equal(r.ok, true, `call ${i + 1} should pass`);
  }
  assert.equal((await checkRate(kv, 'ip:x', opts)).ok, false, '4th call blocked');
});

test('a new time bucket resets the counter', async () => {
  const kv = fakeKV();
  const base = { limit: 2, windowSec: 60 };
  await checkRate(kv, 'ip:y', { ...base, now: 0 });
  await checkRate(kv, 'ip:y', { ...base, now: 0 });
  assert.equal((await checkRate(kv, 'ip:y', { ...base, now: 0 })).ok, false, 'blocked in window 1');
  // advance past the window → new bucket
  assert.equal((await checkRate(kv, 'ip:y', { ...base, now: 61_000 })).ok, true, 'allowed in window 2');
});

test('checkRates short-circuits on the first exceeded limit', async () => {
  const kv = fakeKV();
  const limits = [
    { baseKey: 'ip:z:min', limit: 2, windowSec: 60 },
    { baseKey: 'global:day', limit: 100, windowSec: 86400 },
  ];
  assert.equal((await checkRates(kv, limits, 5_000)).ok, true);
  assert.equal((await checkRates(kv, limits, 5_000)).ok, true);
  const blocked = await checkRates(kv, limits, 5_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.failed, 'ip:z:min');
});

test('keys are independent', async () => {
  const kv = fakeKV();
  const opts = { limit: 1, windowSec: 60, now: 0 };
  assert.equal((await checkRate(kv, 'ip:a', opts)).ok, true);
  assert.equal((await checkRate(kv, 'ip:b', opts)).ok, true, 'different key unaffected');
  assert.equal((await checkRate(kv, 'ip:a', opts)).ok, false, 'same key now blocked');
});

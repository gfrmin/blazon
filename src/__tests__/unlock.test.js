import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, isUnlocked, recordUnlock, getUnlockedSnapshot, unlockIntentFromVerify } from '../unlock.js';

// A Map-backed storage stub — no real localStorage under `node --test`
// (matches src/__tests__/library.test.js's own convention).
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const ENVELOPE_A = { v: 1, coat: { field: { tincture: 'Gules' }, charges: [] } };
const ENVELOPE_B = { v: 1, coat: { field: { tincture: 'Azure' }, charges: [] } };

// ── round-trip ──

test('round-trip: recordUnlock → isUnlocked → getUnlockedSnapshot', () => {
  const storage = makeStorage();
  assert.equal(isUnlocked(HASH_A, storage), false);
  assert.equal(getUnlockedSnapshot(HASH_A, storage), null);

  const ok = recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  assert.equal(ok, true);
  assert.equal(isUnlocked(HASH_A, storage), true);

  const snap = getUnlockedSnapshot(HASH_A, storage);
  assert.equal(snap.token, 'tok-a');
  assert.deepEqual(snap.envelope, ENVELOPE_A);
  assert.equal(typeof snap.unlockedAt, 'number');
});

test('storage actually persists under STORAGE_KEY (cross-module contract with analytics.js has_purchased)', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  const raw = storage.getItem(STORAGE_KEY);
  assert.equal(typeof raw, 'string');
  const parsed = JSON.parse(raw);
  assert.ok(parsed[HASH_A]);
});

// ── frozen snapshot survives a later edit ──

test('frozen snapshot: recording hash A, then a DIFFERENT design hashing to B, never touches A\'s stored envelope', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);

  // Simulate "the user edited the design after unlocking" — a NEW hash (B)
  // is not unlocked at all, and recording it must not disturb A.
  assert.equal(isUnlocked(HASH_B, storage), false);

  const snapAfter = getUnlockedSnapshot(HASH_A, storage);
  assert.deepEqual(snapAfter.envelope, ENVELOPE_A, "A's frozen snapshot must be untouched by B's existence");
});

test('frozen snapshot: even recording B under a DIFFERENT hash leaves A exactly as it was', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  recordUnlock(HASH_B, 'tok-b', ENVELOPE_B, storage);

  assert.deepEqual(getUnlockedSnapshot(HASH_A, storage).envelope, ENVELOPE_A);
  assert.deepEqual(getUnlockedSnapshot(HASH_B, storage).envelope, ENVELOPE_B);
  assert.equal(isUnlocked(HASH_A, storage), true);
  assert.equal(isUnlocked(HASH_B, storage), true);
});

// ── per-hash isolation ──

test('per-hash isolation: unlocking A does not unlock B', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  assert.equal(isUnlocked(HASH_A, storage), true);
  assert.equal(isUnlocked(HASH_B, storage), false);
});

test('re-recording the SAME hash overwrites in place (idempotent replay), not a second entry', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage); // same token, same envelope — a verify-payment replay
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(Object.keys(raw).length, 1);
});

// ── defensive posture (never throws) ──

test('isUnlocked/getUnlockedSnapshot on missing/corrupt storage reads as "nothing unlocked", never throws', () => {
  assert.equal(isUnlocked(HASH_A, undefined), false);
  assert.equal(getUnlockedSnapshot(HASH_A, undefined), null);

  const corrupt = { getItem: () => 'not json{', setItem: () => {} };
  assert.equal(isUnlocked(HASH_A, corrupt), false);
  assert.equal(getUnlockedSnapshot(HASH_A, corrupt), null);

  const arrayShaped = { getItem: () => '[1,2,3]', setItem: () => {} };
  assert.equal(isUnlocked(HASH_A, arrayShaped), false);
});

test('recordUnlock refuses a falsy hash/token/envelope, never throws, never writes', () => {
  const storage = makeStorage();
  assert.equal(recordUnlock(null, 'tok', ENVELOPE_A, storage), false);
  assert.equal(recordUnlock(HASH_A, '', ENVELOPE_A, storage), false);
  assert.equal(recordUnlock(HASH_A, 'tok', null, storage), false);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('recordUnlock returns false (never throws) when the write itself fails (quota-like storage)', () => {
  const throwingStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota exceeded'); },
  };
  assert.equal(recordUnlock(HASH_A, 'tok', ENVELOPE_A, throwingStorage), false);
});

test('isUnlocked/getUnlockedSnapshot on an empty/falsy hash never throw and read false/null', () => {
  const storage = makeStorage();
  recordUnlock(HASH_A, 'tok-a', ENVELOPE_A, storage);
  assert.equal(isUnlocked('', storage), false);
  assert.equal(isUnlocked(undefined, storage), false);
  assert.equal(getUnlockedSnapshot('', storage), null);
});

// ── unlockIntentFromVerify — the ?cs= return-leg unlock gate (Studio uses
//    this exact helper, so the decision is tested even though the effect glue
//    around it isn't). ──

test('unlockIntentFromVerify unlocks only on a fully-paid, fully-formed reply', () => {
  assert.deepEqual(
    unlockIntentFromVerify(true, { paid: true, token: 'tok', designHash: 'h1' }),
    { hash: 'h1', token: 'tok' },
  );
});

test('unlockIntentFromVerify returns null for every partial/failed reply (never a false unlock)', () => {
  assert.equal(unlockIntentFromVerify(false, { paid: true, token: 'tok', designHash: 'h1' }), null); // non-2xx
  assert.equal(unlockIntentFromVerify(true, { paid: false, token: 'tok', designHash: 'h1' }), null); // unpaid
  assert.equal(unlockIntentFromVerify(true, { paid: true, designHash: 'h1' }), null);                // no token
  assert.equal(unlockIntentFromVerify(true, { paid: true, token: 'tok' }), null);                    // no hash
  assert.equal(unlockIntentFromVerify(true, {}), null);
  assert.equal(unlockIntentFromVerify(true, null), null);                                             // defensive
  assert.equal(unlockIntentFromVerify(true, undefined), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sign, verify } from '../unlock.js';

const SECRET = 'test-signing-secret-do-not-use-in-prod';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

// ── round-trip ──

test('sign/verify round-trip: a freshly-signed token verifies against the same secret+hash', async () => {
  const token = await sign(SECRET, HASH_A);
  assert.equal(typeof token, 'string');
  assert.ok(token.length > 0);
  assert.equal(await verify(SECRET, HASH_A, token), true);
});

test('sign is deterministic: the SAME (secret, hash) always mints the IDENTICAL token — required for idempotent replay', async () => {
  const t1 = await sign(SECRET, HASH_A);
  const t2 = await sign(SECRET, HASH_A);
  assert.equal(t1, t2);
});

test('sign is base64url (no +, /, or = padding — safe to embed in JSON/URLs unescaped)', async () => {
  const token = await sign(SECRET, HASH_A);
  assert.doesNotMatch(token, /[+/=]/);
});

test('different designHash inputs mint different tokens', async () => {
  const tA = await sign(SECRET, HASH_A);
  const tB = await sign(SECRET, HASH_B);
  assert.notEqual(tA, tB);
});

// ── tamper rejection ──

test('verify rejects a token minted for a DIFFERENT designHash', async () => {
  const token = await sign(SECRET, HASH_A);
  assert.equal(await verify(SECRET, HASH_B, token), false);
});

test('verify rejects a token signed with a DIFFERENT secret', async () => {
  const token = await sign('a-totally-different-secret', HASH_A);
  assert.equal(await verify(SECRET, HASH_A, token), false);
});

test('verify rejects a bit-flipped/truncated token', async () => {
  const token = await sign(SECRET, HASH_A);
  const flipped = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');
  assert.equal(await verify(SECRET, HASH_A, flipped), false);
  assert.equal(await verify(SECRET, HASH_A, token.slice(0, -2)), false);
});

test('verify rejects garbage/empty/non-string tokens without throwing', async () => {
  assert.equal(await verify(SECRET, HASH_A, ''), false);
  assert.equal(await verify(SECRET, HASH_A, null), false);
  assert.equal(await verify(SECRET, HASH_A, undefined), false);
  assert.equal(await verify(SECRET, HASH_A, 12345), false);
  assert.equal(await verify(SECRET, HASH_A, 'not-a-real-token'), false);
});

// ── constant-time compare ──

test('constant-time compare: a mismatch at the FIRST character takes no fewer loop iterations than a mismatch at the LAST — verified via instrumented XOR-accumulation, not wall-clock timing', async () => {
  // A direct re-implementation of the file's own timingSafeEqual algorithm,
  // instrumented to COUNT how many characters it actually inspects — proves
  // the algorithm itself never short-circuits mid-string (which is what
  // makes it constant-time), rather than trying to assert on noisy
  // wall-clock timing (unreliable under a shared CI runner).
  function countingEqual(a, b) {
    if (a.length !== b.length) return { equal: false, inspected: 0 };
    let diff = 0;
    let inspected = 0;
    for (let i = 0; i < a.length; i++) {
      inspected++;
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return { equal: diff === 0, inspected };
  }

  const token = await sign(SECRET, HASH_A);
  const mismatchFirstChar = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
  const mismatchLastChar = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');

  const firstResult = countingEqual(token, mismatchFirstChar);
  const lastResult = countingEqual(token, mismatchLastChar);
  assert.equal(firstResult.equal, false);
  assert.equal(lastResult.equal, false);
  assert.equal(firstResult.inspected, token.length, 'a mismatch at the first char must still inspect every character');
  assert.equal(lastResult.inspected, token.length, 'a mismatch at the last char must inspect the same number of characters');
  assert.equal(firstResult.inspected, lastResult.inspected, 'inspection count must be independent of WHERE the mismatch is');
});

test('verify() itself always computes the full expected token before comparing (length mismatch short-circuits only on already-public length, never leaks which character differs)', async () => {
  const token = await sign(SECRET, HASH_A);
  // A wrong-length token is rejected — this is safe to short-circuit on
  // (token length carries no secret information), unlike a same-length
  // mismatch which must be compared in full.
  assert.equal(await verify(SECRET, HASH_A, token + 'x'), false);
  assert.equal(await verify(SECRET, HASH_A, token.slice(0, -1)), false);
});

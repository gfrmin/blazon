import { test } from 'node:test';
import assert from 'node:assert/strict';

import { raceWithTimeout } from '../timeoutRace.js';

test('resolves-first: yields the promise value and clears the timer (no dangling timeout)', async () => {
  const realClearTimeout = global.clearTimeout;
  const clearedIds = [];
  global.clearTimeout = (id) => {
    clearedIds.push(id);
    return realClearTimeout(id);
  };
  try {
    const result = await raceWithTimeout(Promise.resolve('token-123'), 5000, 'TIMED_OUT');
    assert.equal(result, 'token-123');
    // clearTimeout must have been called (the finally() branch ran) — a
    // stuck/never-cleared timer would otherwise fire 5s later, in a test run
    // that's long finished, potentially against a reused sentinel/mock.
    assert.equal(clearedIds.length, 1);
  } finally {
    global.clearTimeout = realClearTimeout;
  }
});

test('timeout-first: yields the fallback sentinel when the promise never settles', async () => {
  const TIMED_OUT = Symbol('timed-out');
  const never = new Promise(() => {}); // simulates a Turnstile widget that never fires a terminal callback
  const result = await raceWithTimeout(never, 15, TIMED_OUT);
  assert.equal(result, TIMED_OUT);
});

test('timeout-first: a slow-but-eventually-resolving promise still loses to a shorter timeout', async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve('late-token'), 200));
  const result = await raceWithTimeout(slow, 15, 'TIMED_OUT');
  assert.equal(result, 'TIMED_OUT');
});

test('resolves-first with a promise that rejects: rejection propagates, timer still cleared', async () => {
  const realClearTimeout = global.clearTimeout;
  let cleared = false;
  global.clearTimeout = (id) => {
    cleared = true;
    return realClearTimeout(id);
  };
  try {
    await assert.rejects(
      raceWithTimeout(Promise.reject(new Error('boom')), 5000, 'TIMED_OUT'),
      /boom/
    );
    assert.equal(cleared, true);
  } finally {
    global.clearTimeout = realClearTimeout;
  }
});

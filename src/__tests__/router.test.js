import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseQuery, parseHash, onNavigate } from '../router.js';

// useRoute()/navigate() touch `window`/history and aren't exercised here —
// jsdom isn't part of this repo's test setup (node --test only). Only the
// DOM-free pure helpers are covered. onNavigate's actual firing (via
// navigate() → notify()) needs `window` too — smoke-tested here for its
// subscribe/unsubscribe mechanics only, verified live otherwise (task-7).

test('parseQuery parses a leading-? query string', () => {
  assert.deepEqual(parseQuery('?a=1&b=2'), { a: '1', b: '2' });
});

test('parseQuery parses a query string with no leading ?', () => {
  assert.deepEqual(parseQuery('a=1&b=2'), { a: '1', b: '2' });
});

test('parseQuery decodes "+" as a space (form encoding)', () => {
  assert.deepEqual(parseQuery('?desc=a+sailor+from+galway'), { desc: 'a sailor from galway' });
});

test('parseQuery decodes percent-encoding', () => {
  assert.deepEqual(parseQuery('?q=caf%C3%A9'), { q: 'café' });
});

test('parseQuery on empty/undefined input returns {}', () => {
  assert.deepEqual(parseQuery(''), {});
  assert.deepEqual(parseQuery(undefined), {});
});

test('parseHash strips a leading "#"', () => {
  assert.equal(parseHash('#abc123'), 'abc123');
});

test('parseHash passes through a hash with no leading "#"', () => {
  assert.equal(parseHash('abc123'), 'abc123');
});

test('parseHash on empty/undefined input returns ""', () => {
  assert.equal(parseHash(''), '');
  assert.equal(parseHash(undefined), '');
});

test('onNavigate returns an unsubscribe function; (un)subscribing never throws', () => {
  const unsubscribe = onNavigate(() => {});
  assert.equal(typeof unsubscribe, 'function');
  assert.doesNotThrow(unsubscribe);
  assert.doesNotThrow(unsubscribe); // idempotent — Set.delete on a missing key is a no-op
});

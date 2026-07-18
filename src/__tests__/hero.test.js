import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heroStudioUrl } from '../hero.js';

test('builds a /studio?desc= path with the text percent-encoded', () => {
  assert.equal(heroStudioUrl('a grandmother'), '/studio?desc=a%20grandmother');
});

test('trims leading/trailing whitespace before encoding', () => {
  assert.equal(heroStudioUrl('  a sailor  '), '/studio?desc=a%20sailor');
});

test('encodes special characters (&, =, #) so the query string stays intact', () => {
  const url = heroStudioUrl('bread & butter #1 = best');
  assert.equal(url, '/studio?desc=' + encodeURIComponent('bread & butter #1 = best'));
  // A single `desc` param survives being re-parsed — no stray `&`-delimited keys.
  const params = new URLSearchParams(url.slice('/studio?'.length));
  assert.equal([...params.keys()].length, 1);
  assert.equal(params.get('desc'), 'bread & butter #1 = best');
});

test('empty/whitespace-only input still returns a well-formed path', () => {
  assert.equal(heroStudioUrl(''), '/studio?desc=');
  assert.equal(heroStudioUrl('   '), '/studio?desc=');
});

test('non-string input is coerced, not thrown', () => {
  assert.equal(heroStudioUrl(undefined), '/studio?desc=');
  assert.equal(heroStudioUrl(null), '/studio?desc=');
});

test('unicode text round-trips through decodeURIComponent unchanged', () => {
  const text = 'a grandmère who loved 海';
  const url = heroStudioUrl(text);
  const params = new URLSearchParams(url.slice('/studio?'.length));
  assert.equal(params.get('desc'), text);
});

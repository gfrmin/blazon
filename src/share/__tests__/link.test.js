import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shareUrl } from '../link.js';

test('joins origin + payload under /a/', () => {
  assert.equal(shareUrl('https://blazon.pages.dev', 'cXYZ123'), 'https://blazon.pages.dev/a/cXYZ123');
});

test('strips a trailing slash on the origin before joining', () => {
  assert.equal(shareUrl('https://blazon.pages.dev/', 'cXYZ123'), 'https://blazon.pages.dev/a/cXYZ123');
});

test('works with a local dev origin (with port)', () => {
  assert.equal(shareUrl('http://localhost:5173', 'jAbC'), 'http://localhost:5173/a/jAbC');
});

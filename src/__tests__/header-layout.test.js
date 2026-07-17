import { test } from 'node:test';
import assert from 'node:assert/strict';

import { headerControls } from '../header-layout.js';

test('desktop: every control inline, nothing overflows', () => {
  const { inline, overflow } = headerControls(false);
  assert.deepEqual(inline, ['library', 'save', 'share', 'download']);
  assert.deepEqual(overflow, []);
});

test('mobile: download stays inline; library/save/share collapse to the "⋯" overflow', () => {
  const { inline, overflow } = headerControls(true);
  assert.deepEqual(inline, ['download']);
  assert.deepEqual(overflow, ['library', 'save', 'share']);
});

test('invariant: every control appears exactly once across inline+overflow, in both modes', () => {
  for (const isMobile of [false, true]) {
    const { inline, overflow } = headerControls(isMobile);
    const combined = [...inline, ...overflow].sort();
    assert.deepEqual(combined, ['download', 'library', 'save', 'share']);
  }
});

test('download is always inline — the one control that never collapses', () => {
  assert.ok(headerControls(false).inline.includes('download'));
  assert.ok(headerControls(true).inline.includes('download'));
  assert.ok(!headerControls(false).overflow.includes('download'));
  assert.ok(!headerControls(true).overflow.includes('download'));
});

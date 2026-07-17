import { test } from 'node:test';
import assert from 'node:assert/strict';

import { headerControls } from '../header-layout.js';

test('desktop: every control inline, nothing overflows', () => {
  const { inline, overflow } = headerControls(false);
  assert.deepEqual(inline, ['library', 'save', 'share']);
  assert.deepEqual(overflow, []);
});

test('mobile: library/save/share collapse to the "⋯" overflow', () => {
  const { inline, overflow } = headerControls(true);
  assert.deepEqual(inline, []);
  assert.deepEqual(overflow, ['library', 'save', 'share']);
});

test('invariant: every control appears exactly once across inline+overflow, in both modes', () => {
  for (const isMobile of [false, true]) {
    const { inline, overflow } = headerControls(isMobile);
    const combined = [...inline, ...overflow].sort();
    assert.deepEqual(combined, ['library', 'save', 'share']);
  }
});

// task-21 cleanup: 'download' is deliberately not a control this module
// knows about — Studio.jsx renders the Download button unconditionally,
// outside this layout decision (see header-layout.js's own doc comment).
test('download is not one of the controls this module lays out', () => {
  for (const isMobile of [false, true]) {
    const { inline, overflow } = headerControls(isMobile);
    assert.ok(!inline.includes('download'));
    assert.ok(!overflow.includes('download'));
  }
});

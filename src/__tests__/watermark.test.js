import { test } from 'node:test';
import assert from 'node:assert/strict';

import { footerCaption, WATERMARK_TEXT } from '../watermark.js';
import { PRESETS } from '../heraldry.js';

test('footerCaption returns the formal blazon as the first line', () => {
  const { blazon } = footerCaption(PRESETS[0].design);
  assert.equal(typeof blazon, 'string');
  assert.ok(blazon.length > 0);
});

test('footerCaption always includes the "made with blazon.app" watermark', () => {
  const { watermark } = footerCaption(PRESETS[0].design);
  assert.equal(watermark, 'made with blazon.app');
  assert.equal(watermark, WATERMARK_TEXT);
});

test('watermark text is stable across every preset design', () => {
  for (const p of PRESETS) {
    assert.equal(footerCaption(p.design).watermark, WATERMARK_TEXT);
  }
});

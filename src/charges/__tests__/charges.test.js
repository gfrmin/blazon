import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recolorCharge, viewBoxOf, luminance } from '../recolor-core.js';
import { hasArt, artFile } from '../manifest.js';

const SAMPLE = '<svg viewBox="0 0 10 20"><path style="fill:#ffff00" d="M0 0"/><path style="fill:#000000"/><path fill="none"/><path d="M1 1"/></svg>';

test('recolorCharge swaps body fills to the tincture, keeps outlines + none', () => {
  const out = recolorCharge(SAMPLE, '#1F4E7A');
  assert.ok(!out.includes('<svg'), 'outer <svg> stripped');
  assert.ok(out.includes('fill:#1F4E7A'), 'light body fill recoloured');
  assert.ok(out.includes('fill:#000000'), 'near-black outline kept');
  assert.ok(out.includes('fill="none"'), 'none kept');
  assert.ok(!/ffff00/i.test(out), 'original body colour gone');
});

test('luminance threshold: only near-black is kept as outline', () => {
  assert.ok(luminance('#000000') < 0.12, 'black kept');
  assert.ok(luminance('#111111') < 0.12, 'near-black kept');
  assert.ok(luminance('#ffff00') > 0.12, 'yellow recoloured');
  assert.ok(luminance('#eeeeee') > 0.12, 'light grey recoloured');
  assert.ok(luminance('#808080') > 0.12, 'mid grey recoloured');
});

test('viewBoxOf reads the viewBox (with fallback)', () => {
  assert.equal(viewBoxOf(SAMPLE), '0 0 10 20');
  assert.equal(viewBoxOf('<svg></svg>'), '0 0 100 100');
});

test('artFile resolves attitude → file, with default fallback', () => {
  assert.equal(artFile('lion', 'rampant'), 'lion-rampant');
  assert.equal(artFile('lion', 'passant guardant'), 'lion-passant-guardant');
  assert.equal(artFile('lion', 'nonsense'), 'lion-rampant'); // unknown attitude → default
  assert.equal(artFile('eagle'), 'eagle'); // no attitudes
  assert.equal(artFile('martlet', 'volant'), 'martlett-volant');
  assert.equal(artFile('nope'), null);
});

test('hasArt reflects the manifest', () => {
  assert.equal(hasArt('lion'), true);
  assert.equal(hasArt('fleurdelys'), true);
  assert.equal(hasArt('mullet'), false); // geometric, drawn directly
});

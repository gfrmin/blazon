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

test('artFile resolves a charge (+attitude) → its R2 catalog path', () => {
  assert.equal(artFile('lion', 'rampant'), 'lion/lion-rampant');
  assert.equal(artFile('lion', 'passant guardant'), 'lion/lion-passant-guardant');
  assert.equal(artFile('lion', 'nonsense'), 'lion/lion-rampant'); // unknown attitude → default
  assert.ok(artFile('eagle').endsWith('eagle'));               // curated, no attitudes
  assert.ok(artFile('martlet', 'volant').endsWith('martlett-volant'));
  assert.ok(artFile('fleurdelys').endsWith('fleur-de-lys'));   // model key → catalog key
  assert.equal(artFile('definitely-not-a-charge-xyz'), null);
});

test('hasArt covers curated + raw catalog keys', () => {
  assert.equal(hasArt('lion'), true);            // curated model key
  assert.equal(hasArt('fleurdelys'), true);      // curated model key → catalog
  assert.equal(hasArt('lion-rampant'), true);    // raw catalog key (picker)
  assert.equal(hasArt('definitely-not-a-charge-xyz'), false);
});

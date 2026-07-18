import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { recolorFurniture, findGroupSpan, innerMarkup } from '../recolor.js';
import { ACHIEVEMENT_ART } from '../manifest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART_ROOT = path.join(HERE, '..');
const readArt = (relPath) => readFileSync(path.join(ART_ROOT, relPath), 'utf8');

const mantlingMeta = ACHIEVEMENT_ART.find((a) => a.key === 'cloak');
const torseMeta = ACHIEVEMENT_ART.find((a) => a.key === 'torse');
const mantlingSVG = readArt(mantlingMeta.path);
const torseSVG = readArt(torseMeta.path);

// ── findGroupSpan: balanced-tag matching ────────────────────────────────────
test('findGroupSpan finds a group with nested <g> children (not the first </g>)', () => {
  const span = findGroupSpan(mantlingSVG, 'dexter1-1');
  assert.ok(span, 'span found');
  const slice = mantlingSVG.slice(span.start, span.end);
  assert.match(slice, /^<g[^>]*id="dexter1-1"/);
  assert.ok(slice.endsWith('</g>'));
  // The captured span must be self-balanced (every <g> has a matching </g>).
  const opens = (slice.match(/<g\b[^>]*?(?<!\/)>/g) || []).length;
  const closes = (slice.match(/<\/g>/g) || []).length;
  assert.equal(opens, closes);
});

test('findGroupSpan returns null for an id that does not exist', () => {
  assert.equal(findGroupSpan(mantlingSVG, 'nope-not-here'), null);
});

// ── recolorFurniture: mantling ──────────────────────────────────────────────
test('recolorFurniture recolours the mantling colour ids (dexter1-1/sinister1-1) to colourHex', () => {
  const out = recolorFurniture(mantlingSVG, mantlingMeta.recolorIds, { colourHex: '#9F2C2C', metalHex: '#D4AF52' });
  const dexterColour = mantlingSVG.slice(findGroupSpan(mantlingSVG, 'dexter1-1').start, findGroupSpan(mantlingSVG, 'dexter1-1').end);
  assert.match(dexterColour, /fill:red/);
  const outDexterColour = out.slice(findGroupSpan(out, 'dexter1-1').start, findGroupSpan(out, 'dexter1-1').end);
  assert.doesNotMatch(outDexterColour, /fill:red/);
  assert.match(outDexterColour, /#9F2C2C/);
});

test('recolorFurniture recolours the mantling metal ids (dexter2-1/sinister2-1) to metalHex', () => {
  const out = recolorFurniture(mantlingSVG, mantlingMeta.recolorIds, { colourHex: '#9F2C2C', metalHex: '#D4AF52' });
  const outDexterMetal = out.slice(findGroupSpan(out, 'dexter2-1').start, findGroupSpan(out, 'dexter2-1').end);
  assert.match(outDexterMetal, /#D4AF52/);
  const outSinisterMetal = out.slice(findGroupSpan(out, 'sinister2-1').start, findGroupSpan(out, 'sinister2-1').end);
  assert.match(outSinisterMetal, /#D4AF52/);
});

test('recolorFurniture leaves the mantling body (unlabeled white fills) untouched', () => {
  const out = recolorFurniture(mantlingSVG, mantlingMeta.recolorIds, { colourHex: '#9F2C2C', metalHex: '#D4AF52' });
  // The large lobe/cloth body paths (fill:#fff, no recolour id) must survive verbatim.
  const bodyFillCount = (mantlingSVG.match(/style="fill:#fff/g) || []).length;
  assert.ok(bodyFillCount > 0, 'sanity: the fixture really has unlabeled white body fills');
  assert.equal((out.match(/style="fill:#fff/g) || []).length, bodyFillCount);
});

test('recolorFurniture is a pure function: same output length delta regardless of input hex casing/length differences aside, structure is stable', () => {
  const a = recolorFurniture(mantlingSVG, mantlingMeta.recolorIds, { colourHex: '#111111', metalHex: '#222222' });
  const b = recolorFurniture(mantlingSVG, mantlingMeta.recolorIds, { colourHex: '#111111', metalHex: '#222222' });
  assert.equal(a, b);
});

// ── recolorFurniture: torse ──────────────────────────────────────────────
test('recolorFurniture recolours all 3 torse colour segments and all 3 metal segments', () => {
  const out = recolorFurniture(torseSVG, torseMeta.recolorIds, { colourHex: '#9F2C2C', metalHex: '#D4AF52' });
  for (const id of torseMeta.recolorIds.colour) {
    const span = findGroupSpan(out, id);
    assert.ok(span, `${id} span found`);
    assert.match(out.slice(span.start, span.end), /#9F2C2C/);
  }
  for (const id of torseMeta.recolorIds.metal) {
    const span = findGroupSpan(out, id);
    assert.ok(span, `${id} span found`);
    assert.match(out.slice(span.start, span.end), /#D4AF52/);
  }
});

test('recolorFurniture on torse: colour segments never pick up the metal hex and vice versa', () => {
  const out = recolorFurniture(torseSVG, torseMeta.recolorIds, { colourHex: '#9F2C2C', metalHex: '#D4AF52' });
  for (const id of torseMeta.recolorIds.colour) {
    const span = findGroupSpan(out, id);
    assert.doesNotMatch(out.slice(span.start, span.end), /#D4AF52/);
  }
  for (const id of torseMeta.recolorIds.metal) {
    const span = findGroupSpan(out, id);
    assert.doesNotMatch(out.slice(span.start, span.end), /#9F2C2C/);
  }
});

test('recolorFurniture silently skips an id that is absent (no throw)', () => {
  assert.doesNotThrow(() => recolorFurniture(mantlingSVG, { colour: ['bogus-id'], metal: [] }, { colourHex: '#000', metalHex: '#fff' }));
});

// ── innerMarkup ──────────────────────────────────────────────────────────
test('innerMarkup strips the outer <svg> wrapper, keeping the content', () => {
  const out = innerMarkup(mantlingSVG);
  assert.ok(!/^<svg/i.test(out.trim()));
  assert.ok(!out.trim().endsWith('</svg>'));
  assert.match(out, /<g id="layer1"/);
});

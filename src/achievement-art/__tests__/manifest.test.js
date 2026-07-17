import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HELMETS, TORSE, MANTLING, MOTTOS, COMPARTMENTS, ACHIEVEMENT_ART, findByKey } from '../manifest.js';

const ART_DIR = dirname(fileURLToPath(new URL('../manifest.js', import.meta.url)));
const svgText = (path) => readFileSync(join(ART_DIR, path), 'utf8');

test('all 5 rank-meaningful helmets are present, each with a viewBox', () => {
  const ranks = HELMETS.map((h) => h.rank).sort();
  assert.deepEqual(ranks, ['baronet', 'esquire', 'knight', 'peer', 'royal']);
  for (const h of HELMETS) {
    assert.match(h.viewBox, /^0 0 [\d.]+ [\d.]+$/, `${h.key} has a numeric viewBox`);
  }
});

test('torse recolour ids (3 colour + 3 metal twists) survived svgo', () => {
  assert.ok(TORSE, 'TORSE manifest entry exists');
  assert.equal(TORSE.recolorIds.colour.length, 3);
  assert.equal(TORSE.recolorIds.metal.length, 3);
  const svg = svgText(TORSE.path);
  for (const id of [...TORSE.recolorIds.colour, ...TORSE.recolorIds.metal]) {
    assert.ok(svg.includes(`id="${id}"`), `torse.svg still has id="${id}" after svgo`);
  }
});

test('mantling recolour ids (dexter/sinister x colour/metal) survived svgo', () => {
  assert.equal(MANTLING.length, 1, 'one plain mantling variant vendored (approved scope)');
  const cloak = MANTLING[0];
  assert.deepEqual(cloak.recolorIds.colour.sort(), ['dexter1-1', 'sinister1-1']);
  assert.deepEqual(cloak.recolorIds.metal.sort(), ['dexter2-1', 'sinister2-1']);
  const svg = svgText(cloak.path);
  for (const id of [...cloak.recolorIds.colour, ...cloak.recolorIds.metal]) {
    assert.ok(svg.includes(`id="${id}"`), `cloak.svg still has id="${id}" after svgo`);
  }
});

test('every motto scroll carries a surviving id="textPath"', () => {
  assert.equal(MOTTOS.length, 2);
  for (const m of MOTTOS) {
    assert.equal(m.textPathId, 'textPath');
    const svg = svgText(m.path);
    assert.ok(svg.includes('id="textPath"'), `${m.key} still has id="textPath" after svgo`);
  }
});

test('plaque.svg was NOT vendored (bare <g> fragment, no textPath)', () => {
  assert.ok(!MOTTOS.some((m) => m.key === 'plaque'));
});

test('token compartment vendored and cheap', () => {
  assert.equal(COMPARTMENTS.length, 1);
  assert.equal(COMPARTMENTS[0].key, 'pedestal');
});

test('findByKey resolves a flat asset by dir+key', () => {
  assert.equal(findByKey('helmet', 'royal').rank, 'royal');
  assert.equal(findByKey('mantling', 'cloak').kind, 'mantling');
  assert.equal(findByKey('helmet', 'definitely-not-a-helmet'), null);
});

test('every asset has a licence with a non-empty artist and license string', () => {
  for (const a of ACHIEVEMENT_ART) {
    assert.ok(a.license?.artist, `${a.dir}/${a.key} has an artist`);
    assert.ok(a.license?.license, `${a.dir}/${a.key} has a license string`);
  }
});

test('post-svgo bundle stays comfortably under the ~1.5 MB budget', () => {
  const totalBytes = ACHIEVEMENT_ART.reduce((sum, a) => sum + Buffer.byteLength(svgText(a.path), 'utf8'), 0);
  assert.ok(totalBytes < 1.5 * 1024 * 1024, `total ${(totalBytes / 1024).toFixed(1)}kb should be < 1.5MB`);
});

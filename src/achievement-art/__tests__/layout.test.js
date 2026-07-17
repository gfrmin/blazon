import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYOUT, shieldBox, mantlingBox, helmBox, torseBox, crestBox, supporterBox,
  compartmentBox, mottoBox, torseLiveryHex, mantlingLiveryHex, fitMotto, MOTTO_SOFT_MAX,
  aspectFromViewBox, mottoTextLength,
} from '../layout.js';

// ── aspectFromViewBox ───────────────────────────────────────────────────
test('aspectFromViewBox reads width/height from a viewBox string', () => {
  assert.ok(Math.abs(aspectFromViewBox('0 0 270.013 316.914') - 270.013 / 316.914) < 1e-9);
});

test('aspectFromViewBox falls back to 1 for a malformed/missing viewBox', () => {
  assert.equal(aspectFromViewBox(''), 1);
  assert.equal(aspectFromViewBox(undefined), 1);
});

// ── shieldBox / mantlingBox ─────────────────────────────────────────────────
test('shieldBox derives height from the 200×240 (5:6) aspect', () => {
  const b = shieldBox();
  assert.equal(b.w, LAYOUT.shield.w);
  assert.equal(b.h, b.w * (240 / 200));
});

test('mantlingBox derives height from the 1000×1200 (5:6) aspect', () => {
  const b = mantlingBox();
  assert.equal(b.h, b.w * (1200 / 1000));
});

test('mantling and shield share the same aspect ratio (Task 8 5× finding)', () => {
  const s = shieldBox();
  const m = mantlingBox();
  assert.ok(Math.abs(s.w / s.h - m.w / m.h) < 1e-9);
});

// ── helm/torse/crest stacking ───────────────────────────────────────────────
test('helmBox sits just above the shield, its neck overlapping the shield top edge', () => {
  const sb = shieldBox();
  const hb = helmBox('esquire', 0.86);
  const helmBottom = hb.y + hb.h;
  assert.ok(helmBottom > sb.y, 'helm dips below the shield top edge (shieldOverlap)');
  assert.equal(helmBottom, sb.y + LAYOUT.helm.shieldOverlap);
});

test('helmBox width follows the supplied aspect ratio (no distortion)', () => {
  const hb = helmBox('peer', 0.76);
  assert.ok(Math.abs(hb.w / hb.h - 0.76) < 1e-9);
});

test('helmBox is horizontally centred on the shield', () => {
  const sb = shieldBox();
  const hb = helmBox('esquire', 0.86);
  assert.ok(Math.abs((hb.x + hb.w / 2) - (sb.x + sb.w / 2)) < 1e-9);
});

test('torseBox centres on the helm crown, ABOVE the helm neck (not at its base)', () => {
  const hb = helmBox('esquire', 0.86);
  const tb = torseBox('esquire', 0.86);
  assert.ok(tb.centerY < hb.y + hb.h, 'torse centre sits above the helm bottom');
  assert.ok(tb.centerY > hb.y, 'torse centre sits below the helm top (within the helm art)');
});

test('torseBox honours a per-style crown fraction — different styles, different centreY', () => {
  const esquire = torseBox('esquire', 0.86);
  const royal = torseBox('royal', 0.85);
  // Both helms have ~the same target height, but different crown fractions
  // (LAYOUT.helm.crown), so their torse centreY must differ.
  assert.notEqual(esquire.centerY, royal.centerY);
});

test('torseBox falls back to the default crown fraction for an unknown style', () => {
  const known = torseBox('made-up-style', 0.86);
  const bareHelm = helmBox('made-up-style', 0.86);
  assert.equal(known.centerY, bareHelm.y + bareHelm.h * LAYOUT.helm.crown.default);
});

test('crestBox stands on the torse: its bottom sinks slightly into the torse band', () => {
  const tb = torseBox('esquire', 0.86);
  const cb = crestBox('esquire', 0.86);
  const crestBottom = cb.y + cb.h;
  assert.ok(crestBottom > tb.centerY, 'crest overlaps down past the torse centre');
  assert.ok(crestBottom < tb.y + tb.h, 'crest does not sink past the whole torse band');
});

test('crestBox is horizontally centred on the torse/helm', () => {
  const tb = torseBox('esquire', 0.86);
  const cb = crestBox('esquire', 0.86);
  assert.ok(Math.abs((cb.x + cb.w / 2) - tb.cx) < 1e-9);
});

// ── supporters ───────────────────────────────────────────────────────────
test('supporterBox: dexter sits left of the shield, sinister right, mirrored', () => {
  const sb = shieldBox();
  const dexter = supporterBox('dexter');
  const sinister = supporterBox('sinister');
  assert.ok(dexter.x + dexter.w <= sb.x, 'dexter box stays clear of the shield');
  assert.ok(sinister.x >= sb.x + sb.w, 'sinister box stays clear of the shield');
  assert.equal(dexter.mirror, false);
  assert.equal(sinister.mirror, true);
});

test('supporterBox feet sit below the shield base by footDrop', () => {
  const sb = shieldBox();
  const dexter = supporterBox('dexter');
  assert.equal(dexter.y + dexter.h, sb.y + sb.h + LAYOUT.supporters.footDrop);
});

// ── compartment / motto ───────────────────────────────────────────────────
test('compartmentBox sits directly under the shield base', () => {
  const sb = shieldBox();
  const cb = compartmentBox();
  assert.equal(cb.y, sb.y + sb.h + LAYOUT.compartment.gapAboveShield);
});

test('mottoBox sits under the compartment when one is present', () => {
  const cb = compartmentBox();
  const mb = mottoBox(true);
  assert.equal(mb.y, cb.y + cb.h + LAYOUT.motto.gapAboveCompartment);
});

test('mottoBox sits directly under the shield when there is no compartment', () => {
  const sb = shieldBox();
  const mb = mottoBox(false);
  assert.equal(mb.y, sb.y + sb.h + LAYOUT.motto.gapAboveNoCompartment);
});

test('mottoBox with a compartment sits lower than without one', () => {
  assert.ok(mottoBox(true).y > mottoBox(false).y);
});

test('every box fits within the declared viewBox width', () => {
  for (const b of [shieldBox(), mantlingBox(), helmBox('royal', 0.85), torseBox('royal', 0.85),
    crestBox('royal', 0.85), compartmentBox(), mottoBox(true), mottoBox(false)]) {
    assert.ok(b.x >= -1, `x within bounds: ${b.x}`);
    assert.ok(b.x + b.w <= LAYOUT.viewBox.w + 1, `right edge within bounds: ${b.x + b.w}`);
  }
});

// ── livery → fill mapping (the opposite-order gotcha) ───────────────────────
test('torseLiveryHex reads tinctures as [metal, colour]', () => {
  const { colourHex, metalHex } = torseLiveryHex({ tinctures: ['Or', 'Gules'] }); // [metal, colour]
  assert.equal(metalHex, '#D4AF52'); // Or
  assert.equal(colourHex, '#9F2C2C'); // Gules
});

test('mantlingLiveryHex reads tinctures as [colour, metal] — OPPOSITE order from torse', () => {
  const { colourHex, metalHex } = mantlingLiveryHex({ tinctures: ['Gules', 'Or'] }); // [colour, metal]
  assert.equal(colourHex, '#9F2C2C'); // Gules
  assert.equal(metalHex, '#D4AF52'); // Or
});

test('given the SAME tincture pair, torse and mantling resolve to the SAME colour/metal hexes despite opposite array order', () => {
  const torse = torseLiveryHex({ tinctures: ['Argent', 'Azure'] }); // [metal, colour]
  const mantling = mantlingLiveryHex({ tinctures: ['Azure', 'Argent'] }); // [colour, metal]
  assert.equal(torse.colourHex, mantling.colourHex);
  assert.equal(torse.metalHex, mantling.metalHex);
});

// ── motto fitting ───────────────────────────────────────────────────────
test('fitMotto leaves a short motto untouched', () => {
  assert.equal(fitMotto('Hold fast'), 'Hold fast');
});

test('fitMotto leaves a motto exactly at the soft (30-char) warning threshold untouched', () => {
  const thirty = 'x'.repeat(MOTTO_SOFT_MAX);
  assert.equal(fitMotto(thirty), thirty);
  assert.equal(thirty.length, 30);
});

test('fitMotto truncates a motto past the hard cap, with an ellipsis', () => {
  const long = 'a'.repeat(90);
  const fitted = fitMotto(long);
  assert.ok(fitted.length <= 60);
  assert.ok(fitted.endsWith('…'));
});

test('fitMotto trims surrounding whitespace', () => {
  assert.equal(fitMotto('  Hold fast  '), 'Hold fast');
});

test('fitMotto tolerates an empty/undefined motto', () => {
  assert.equal(fitMotto(''), '');
  assert.equal(fitMotto(undefined), '');
});

// ── mottoTextLength ─────────────────────────────────────────────────────
test('mottoTextLength grows with the character count for short mottos (not force-stretched)', () => {
  const short = mottoTextLength('Hold fast'); // 9 chars
  const longer = mottoTextLength('Steadfast through the dark'); // 27 chars
  assert.ok(short < longer);
});

test('mottoTextLength is clamped at the scroll usable span for a 30-char motto and beyond', () => {
  const thirty = mottoTextLength('x'.repeat(30));
  const sixty = mottoTextLength('x'.repeat(60));
  assert.ok(thirty <= 820);
  assert.ok(sixty <= 820);
});

test('mottoTextLength never returns 0 (invalid SVG textLength) for empty input', () => {
  assert.ok(mottoTextLength('') > 0);
  assert.ok(mottoTextLength(undefined) > 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importJSXBundle } from './helpers/bundleJSX.mjs';

// This is the M3 dependency: Achievement.jsx MUST render standalone via
// renderToStaticMarkup in a Node/Workers context, with no browser and no R2
// fetch — that's the whole point of the artCache seam. Since plain
// `node --test` has no JSX transform and no Vite `?raw` loader of its own,
// `importJSXBundle` (esbuild, already an installed transitive dependency of
// vite — see helpers/bundleJSX.mjs) bundles Achievement.jsx and its whole
// import graph (achievement-art/*, charges/*, model/*, Shield.jsx) into plain
// JS first, so this test exercises the REAL component, not a mock.
const achMod = await importJSXBundle(new URL('../Achievement.jsx', import.meta.url).pathname);
const Achievement = achMod.default;

const { default: React } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { PRESETS, coat, withDefaultAchievement } = await import('../heraldry.js');

// A stub artCache: every file lookup resolves to the SAME fixed, valid
// {viewBox, inner} art — deterministic and offline (no R2 fetch), exactly the
// shape resolveCharge()/useCharge() produce. This is the pre-resolved-art
// contract Task 17's server caller must fulfil.
const STUB_INNER = '<path class="stub-charge-mark" d="M0,0 L100,100 L0,100 Z" />';
const artCacheStub = new Proxy({}, { get: () => ({ viewBox: '0 0 100 100', inner: STUB_INNER }) });

/**
 * A real (not full-blown XML-library) well-formedness check: tokenizes tags,
 * ignoring comments/self-closing tags, and verifies open/close tags balance
 * and nest correctly — enough to catch a genuinely broken (unclosed/
 * mismatched) SVG tree without a DOM/XML parser dependency (none in this repo).
 */
function assertWellFormedXML(markup, label) {
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(markup))) {
    const [, closing, name, , selfClose] = m;
    if (closing) {
      const top = stack.pop();
      assert.equal(top, name, `${label}: mismatched closing tag — expected </${top}>, got </${name}> near index ${m.index}`);
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tag(s): ${stack.join(', ')}`);
}

function ssrRender(design, extraProps = {}) {
  return renderToStaticMarkup(React.createElement(Achievement, { design, ssr: true, artCache: artCacheStub, ...extraProps }));
}

// ── SSR smoke: presets ──────────────────────────────────────────────────
for (const [i, preset] of PRESETS.entries()) {
  test(`SSR: renderToStaticMarkup(<Achievement design={PRESETS[${i}]} ssr artCache=stub />) yields well-formed SVG`, () => {
    const markup = ssrRender(preset.design);
    assert.match(markup, /^<svg/);
    assert.match(markup, /viewBox="0 0 1000 1200"/);
    assertWellFormedXML(markup, `PRESETS[${i}]`);
    // No React/JS artefacts leaking into the markup.
    assert.doesNotMatch(markup, /undefined|\[object Object\]|NaN/);
  });
}

// ── SSR smoke: an explicit achievement (exercises the id-based recolour end
// to end, torse/mantling opposite-order tincture mapping, helm material swap,
// crest/supporter R2-art layers via the artCache stub, motto, and — for one
// case — a compartment) ──
test('SSR: a fully explicit achievement (peer helm, custom torse/mantling tinctures, compartment) renders every layer group', () => {
  const design = withDefaultAchievement({
    ...coat({ tincture: 'Vert' }, [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }]),
    motto: 'Ever forward',
  });
  design.achievement.helm = { style: 'peer' };
  design.achievement.torse = { tinctures: ['Argent', 'Gules'] }; // [metal, colour]
  design.achievement.mantling = { tinctures: ['Gules', 'Argent'] }; // [colour, metal] — SAME livery, opposite order
  design.achievement.compartment = { type: 'pedestal' };

  const markup = ssrRender(design);
  assertWellFormedXML(markup, 'explicit-achievement');

  // Layer groups present: mantling (own viewBox), shield (Shield.jsx's own
  // SHIELD_PATH signature), helm (peer's own viewBox), torse (its viewBox),
  // crest + supporters (the stub charge mark, 3×: crest + dexter + sinister-
  // matched-pair), compartment (its own viewBox), motto text.
  assert.match(markup, /viewBox="0 0 1000 1200"/); // root + mantling
  assert.match(markup, /M18,14 H182/); // Shield.jsx's SHIELD_PATH — proves the local shield slot rendered
  assert.match(markup, /viewBox="0 0 491.823 651.269"/); // peer helmet's own viewBox (manifest.js)
  assert.match(markup, /viewBox="0 0 204.998 42.041"/); // torse
  assert.match(markup, /viewBox="0 0 889.222 60.056"/); // compartment (present on this design)
  const stubCount = (markup.match(/stub-charge-mark/g) || []).length;
  // 4, not 3: the escutcheon's OWN lion charge (rendered by <Shield chargeArt=
  // {artCache}>, the SAME artCache Achievement passes straight through) also
  // resolves via the stub — proving artCache is shared correctly between the
  // shield slot and the achievement's own crest/supporters, not two separate
  // caches.
  assert.equal(stubCount, 4, 'escutcheon charge + crest + dexter + sinister (matched pair) each render the stub art');
  assert.match(markup, />Ever forward</); // the motto text itself
  assert.doesNotMatch(markup, /<foreignObject/); // ssr=true must never use the DrawShield fallback
});

// ── SSR smoke: out-of-vocab escutcheon degrades to the LOCAL shield, never
// a <foreignObject> (does not survive renderToStaticMarkup→resvg) ──
test('SSR: an out-of-vocab escutcheon (paly) degrades to the local shield, no <foreignObject>', () => {
  const design = {
    field: { division: { type: 'paly', tinctures: ['Gules', 'Or'], count: 6 } },
    charges: [{ role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
  };
  const markup = ssrRender(design);
  assertWellFormedXML(markup, 'out-of-vocab-ssr');
  assert.doesNotMatch(markup, /<foreignObject/);
  assert.match(markup, /M18,14 H182/); // the local <Shield> still rendered (degraded, but present)
});

// Same out-of-vocab design WITHOUT ssr — proves the seam actually switches
// behaviour (ssr isn't a no-op) and that the DrawShield URL it builds is
// achievement-clause-free (§3a, exercised through the whole component, not
// just drawshield.js in isolation).
test('non-SSR: the same out-of-vocab escutcheon renders the DrawShield <foreignObject> fallback with a clean blazon param', () => {
  const design = {
    field: { division: { type: 'paly', tinctures: ['Gules', 'Or'], count: 6 } },
    charges: [{ role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
    achievement: { helm: { style: 'knight' } }, // present, but must never reach the DrawShield URL
  };
  const markup = renderToStaticMarkup(React.createElement(Achievement, { design, artCache: artCacheStub }));
  assertWellFormedXML(markup, 'out-of-vocab-non-ssr');
  assert.match(markup, /<foreignObject/);
  const imgSrc = markup.match(/<img[^>]*src="([^"]*)"/)[1].replace(/&amp;/g, '&');
  const blazonParam = new URL(imgSrc).searchParams.get('blazon');
  assert.doesNotMatch(blazonParam, /Crest:|Supporters:|Mantling:|Helm:|Compartment:/);
});

// ── shieldSlot override ────────────────────────────────────────────────
test('shieldSlot override replaces the default Shield/fallback logic entirely', () => {
  const markup = ssrRender(PRESETS[0].design, {
    shieldSlot: React.createElement('rect', { width: 200, height: 240, fill: 'hotpink', 'data-testid': 'override-marker' }),
  });
  assertWellFormedXML(markup, 'shieldSlot-override');
  assert.match(markup, /data-testid="override-marker"/);
  assert.doesNotMatch(markup, /M18,14 H182/); // the default <Shield> must NOT have rendered
});

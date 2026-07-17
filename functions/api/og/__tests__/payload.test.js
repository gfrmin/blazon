import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// NOTE ON SCOPE (see functions/_lib/resvg.js's header + task-17-report.md):
// this file imports directly from '../[payload].js', which imports
// functions/_lib/resvg.js. resvg.js's `.wasm`/`.bin` loads are DEFERRED
// (dynamic `import()` inside `svgToPng`, never at module-evaluation time),
// so importing '../[payload].js' here is safe under plain `node --test` —
// but actually CALLING onRequestGet only stays safe as long as the request
// never reaches `svgToPng` (the bad-payload redirect returns before that).
// Node's own native WASM-as-ESM loader can't resolve this particular
// wasm-bindgen module's own glue imports (confirmed directly — see the
// report), so the FULL rasterise path is instead exercised below via a
// separate, Node-appropriate loading route (raw bytes via fs, matching
// resvg-wasm's own Node-oriented CJS entry point) — this is the "resvg runs
// in node too" case the brief invites; used here to also assert PNG magic
// bytes on the REAL composed SVG (buildOgSVG + renderAchievementSVG), not
// just a toy fixture.

import { onRequestGet, buildOgSVG, renderAchievementSVG } from '../[payload].js';
import { resolveAchievementArt } from '../../../_lib/achievementArt.js';
import { OG_WIDTH, OG_HEIGHT } from '../../../_lib/ogImage.js';
import { encodeCoat } from '../../../../src/share/codec.js';
import { blazon } from '../../../../src/model/blazon.js';
import { withDefaultAchievement, clearCrest } from '../../../../src/heraldry.js';
import { R2_BASE } from '../../../../src/charges/recolor.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

// A trivial, valid charge SVG (matches what R2 actually serves shape-wise —
// a viewBox + a fill resolveCharge's recolorCharge can swap).
const FAKE_CHARGE_SVG = '<svg viewBox="0 0 100 100"><path fill="red" d="M10 10 L90 10 L90 90 L10 90 Z"/></svg>';

function stubR2Fetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(R2_BASE)) return { ok: true, text: async () => FAKE_CHARGE_SVG };
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}

const request = (path) => ({ url: `https://blazon.pages.dev${path}` });

// A full achievement design with a real vendored-art crest/supporters
// (lion, always has art — see src/charges/manifest.js's CHARGE_ART) and a
// motto, so the art-prefetch path is actually exercised.
function fullDesign() {
  return withDefaultAchievement({
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
    motto: 'Fortis et Fidelis',
  });
}

test('bad payload -> 302 redirect to / (never touches resvg/wasm)', async () => {
  const res = await onRequestGet({ request: request('/api/og/not-a-real-payload'), params: { payload: 'not-a-real-payload' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://blazon.pages.dev/');
});

test('resolveAchievementArt: prefetches the shield charge + crest + both (matched-pair) supporters, none for a design with no achievement art', async () => {
  stubR2Fetch();
  const coat = fullDesign();
  const cache = await resolveAchievementArt(coat);
  // lion is used as the shield charge, the default crest, AND the default
  // matched-pair supporters — same file, one cache entry (dedup via fetchCharge's
  // own path-keyed cache, see src/charges/recolor.js).
  const files = Object.keys(cache);
  assert.equal(files.length, 1);
  assert.match(files[0], /lion-rampant/);
  assert.equal(cache[files[0]].viewBox, '0 0 100 100');
  assert.ok(cache[files[0]].inner.includes('#')); // recoloured (hex fill), not the raw "red"
});

test('resolveAchievementArt honours backfill=false semantics: a design with NO achievement key needs no art', async () => {
  stubR2Fetch();
  const bare = { field: { tincture: 'Azure' }, charges: [] }; // never backfilled
  const cache = await resolveAchievementArt(bare);
  assert.deepEqual(cache, {});
});

test('renderAchievementSVG: pre-resvg markup contains every expected layer, aria-label is the formal blazon (no PII), and honours backfill=false', async () => {
  stubR2Fetch();
  const coat = fullDesign();
  const svg = await renderAchievementSVG(coat);

  assert.match(svg, /viewBox="0 0 1000 1200"/); // Achievement's own canvas
  assert.match(svg, new RegExp(`aria-label="${escapeReg(blazon(coat, 'formal'))}"`));
  assert.equal(svg.includes('foreignObject'), false); // ssr=true — never the DrawShield fallback markup
  assert.equal(svg.includes('Fortis et Fidelis'), true); // the motto text itself is present in the markup

  // backfill=false: a design with the crest explicitly cleared renders with
  // NO crest markup reachable, even though withDefaultAchievement would
  // normally re-seed one.
  const setAside = clearCrest(coat);
  const svgNoCrest = await renderAchievementSVG(setAside);
  assert.equal(setAside.achievement.crest, undefined);
  // The crest is the only consumer of its own recoloured art in that slot;
  // with no crest object, no crest <svg> art wrapper is emitted for it.
  // (Loose but real signal: fewer nested recoloured-art <svg> wrappers than
  // the full design, which has the shield's own charge + crest + dexter +
  // sinister = 4 uses of the SAME lion file's art markup vs. 3 for the
  // crestless version.)
  const countArtSvgs = (s) => (s.match(/viewBox="0 0 100 100"/g) || []).length;
  assert.equal(countArtSvgs(svg), 4);
  assert.equal(countArtSvgs(svgNoCrest), 3);
});

test('buildOgSVG: wraps the achievement centred on the fixed OG canvas, brand background', () => {
  const inner = '<svg viewBox="0 0 1000 1200">INNER</svg>';
  const out = buildOgSVG(inner);
  assert.match(out, new RegExp(`width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}"`));
  assert.match(out, /<rect width="1200" height="1200" fill="#090C13"\/>/);
  assert.ok(out.includes(inner));
  // Portrait 1000x1200 letterboxed into a 1200x1200 square: 100px each side, 0 vertically.
  assert.match(out, /<svg x="100" y="0" width="1000" height="1200"/);
});

// ── The wasm rasterise itself, exercised for real (see the file-header note
// for why this uses its own Node-appropriate loading path rather than
// importing functions/_lib/resvg.js's production Workers-oriented one). ──

test('resvg-wasm rasterises the REAL composed OG SVG to a valid PNG (magic bytes, correct dimensions)', async () => {
  stubR2Fetch();
  const { Resvg, initWasm } = await import('@resvg/resvg-wasm');
  const wasmBytes = await readFile(fileURLToPath(new URL('../../../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)));
  const fontBytes = await readFile(fileURLToPath(new URL('../../../_lib/fonts/cormorant-garamond-italic-subset.bin', import.meta.url)));
  await initWasm(wasmBytes);

  const coat = fullDesign();
  const achievementSVG = await renderAchievementSVG(coat);
  const svg = buildOgSVG(achievementSVG);

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { fontBuffers: [new Uint8Array(fontBytes)], loadSystemFonts: false, serifFamily: 'Cormorant Garamond', defaultFontFamily: 'Cormorant Garamond' },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  assert.deepEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(rendered.width, OG_WIDTH);
  assert.equal(rendered.height, OG_HEIGHT);
  // A real, non-trivial image (a blank/broken render would be a tiny, mostly-empty PNG).
  assert.ok(png.length > 10_000, `expected a substantial PNG, got ${png.length} bytes`);
});

test('no PII: neither the encoded payload nor the rendered SVG carry a free-text description', async () => {
  stubR2Fetch();
  const coat = fullDesign();
  const payload = await encodeCoat(coat);
  assert.equal(payload.includes('desc'), false);
  const svg = await renderAchievementSVG(coat);
  assert.equal(svg.includes('desc='), false);
});

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
import { withDefaultAchievement, clearCrest, tinctureHex } from '../../../../src/heraldry.js';
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

const request = (path, ip = '198.51.100.1') => ({
  url: `https://blazon.pages.dev${path}`,
  headers: { get: (name) => (name === 'cf-connecting-ip' ? ip : null) },
});

// Minimal in-memory KV stand-in (matches functions/_lib/__tests__/ratelimit.test.js's fakeKV).
function fakeKV() {
  const m = new Map();
  return { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); } };
}

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

// A design with the SAME charge file (lion rampant) used in two slots with
// DIFFERENT tinctures — the shield's own charge is Or, but the crest is
// explicitly overridden to Argent (so withDefaultAchievement's own
// echo-the-principal-charge default, which would coincide file+hex, is
// bypassed). Supporters are left to default (Or, echoing the shield charge)
// — this is the exact "same file, different tincture, different slots"
// shape review round 1 flagged: a heraldic-common pattern (an Or lion on the
// shield, an Argent lion crest) that file-only artCache keying collapsed to
// one colour on the OG image only (on-screen was always correct).
function twoTinctureLionDesign() {
  return withDefaultAchievement({
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
    achievement: {
      crest: { role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
    },
  });
}

test('bad payload -> 302 redirect to / (never touches resvg/wasm)', async () => {
  const res = await onRequestGet({ request: request('/api/og/not-a-real-payload'), params: { payload: 'not-a-real-payload' }, env: {} });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://blazon.pages.dev/');
});

// ── SEC-2(a): rate limiting ─────────────────────────────────────────────

test('SEC-2: rate limited -> 429, never reaches decodeCoat/resvg (env.RATE present)', async () => {
  const kv = fakeKV();
  const payload = 'not-a-real-payload'; // would 302 anyway — the point is it never gets that far once limited
  let last;
  // PER_IP_PER_MIN is 20 — exhaust it, then expect the 21st to 429.
  for (let i = 0; i < 21; i++) {
    last = await onRequestGet({ request: request(`/api/og/${payload}`), params: { payload }, env: { RATE: kv } });
  }
  assert.equal(last.status, 429);
});

test('SEC-2: env.RATE absent -> no rate limiting applied (fail-open, matches generate.js/checkout.js posture)', async () => {
  const res = await onRequestGet({ request: request('/api/og/not-a-real-payload'), params: { payload: 'not-a-real-payload' }, env: {} });
  assert.equal(res.status, 302); // reaches the normal bad-payload path, not a 429
});

test('SEC-2: different IPs are rate-limited independently', async () => {
  const kv = fakeKV();
  const payload = 'not-a-real-payload';
  let lastA;
  for (let i = 0; i < 21; i++) {
    lastA = await onRequestGet({ request: request(`/api/og/${payload}`, '203.0.113.5'), params: { payload }, env: { RATE: kv } });
  }
  assert.equal(lastA.status, 429);
  const resB = await onRequestGet({ request: request(`/api/og/${payload}`, '203.0.113.6'), params: { payload }, env: { RATE: kv } });
  assert.equal(resB.status, 302, 'a different IP must not be blocked by the first IP\'s limit');
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

test('resolveAchievementArt: the SAME charge file used with DIFFERENT tinctures in different slots resolves to DISTINCT cache entries with DIFFERENT recoloured art (review round 1 — file-only keying collapsed these to one colour)', async () => {
  stubR2Fetch();
  const coat = twoTinctureLionDesign();
  assert.equal(coat.charges[0].tincture, 'Or');
  assert.equal(coat.achievement.crest.tincture, 'Argent');

  const cache = await resolveAchievementArt(coat);
  const keys = Object.keys(cache);
  assert.ok(keys.every((k) => /lion-rampant/.test(k)), `expected every key to reference the lion-rampant file, got ${JSON.stringify(keys)}`);
  // Two distinct file+hex entries for the SAME underlying file — proves the
  // cache is keyed by the tincture-resolved composite identity (artKey),
  // not file alone (which would collapse both tinctures into a single,
  // last-write-wins entry — exactly the bug this locks against).
  assert.equal(keys.length, 2, `expected 2 distinct file+hex cache entries (one per tincture), got ${keys.length}: ${JSON.stringify(keys)}`);

  const orKey = keys.find((k) => k.endsWith(tinctureHex('Or')));
  const argentKey = keys.find((k) => k.endsWith(tinctureHex('Argent')));
  assert.ok(orKey, `expected an Or-tincture cache entry among ${JSON.stringify(keys)}`);
  assert.ok(argentKey, `expected an Argent-tincture cache entry among ${JSON.stringify(keys)}`);
  assert.notEqual(cache[orKey].inner, cache[argentKey].inner, 'the two tinctures must bake DIFFERENT colours into the recoloured markup');
});

test("renderAchievementSVG: the crest bakes its OWN tincture into the recoloured art, distinct from the shield charge's, even though both slots share the same charge file (review round 1 — the OG image must not collapse same-file/different-tincture slots to one colour)", async () => {
  stubR2Fetch();
  const coat = twoTinctureLionDesign();
  const svg = await renderAchievementSVG(coat);

  // Match the BAKED inner <path> fill specifically (recolorCharge writes the
  // resolved hex directly onto the charge's own path — see
  // src/charges/recolor-core.js). This is deliberately NOT a check of the
  // wrapping <svg fill="…"> element ArtCharge/VendoredCharge always emit
  // (src/Achievement.jsx, src/Shield.jsx) — that wrapper's fill is computed
  // per-slot directly from the coat, so it's ALWAYS correct regardless of
  // the artCache bug and would never catch this regression. The bug is
  // specifically that the cached `art.inner` — and therefore this baked
  // path fill — could be the WRONG slot's tincture.
  const fakePathD = 'M10 10 L90 10 L90 90 L10 90 Z'; // FAKE_CHARGE_SVG's own single <path>'s d
  const bakedFillRe = new RegExp(`<path fill="(#[0-9a-fA-F]+)" d="${escapeReg(fakePathD)}"`, 'g');
  const bakedFills = new Set([...svg.matchAll(bakedFillRe)].map((m) => m[1]));

  const orHex = tinctureHex('Or');
  const argentHex = tinctureHex('Argent');
  assert.ok(bakedFills.has(orHex), `expected the Or-tinctured shield charge/supporters to bake in ${orHex}, got ${JSON.stringify([...bakedFills])}`);
  // The crest is explicitly Argent — a DIFFERENT tincture on the SAME charge
  // file. Pre-fix, file-only artCache keying meant the crest's `art.inner`
  // was whichever tincture resolved last for that shared file (in practice,
  // Or — the shield/supporters' own tincture), so the baked Argent hex never
  // appeared anywhere in the composed markup at all.
  assert.ok(bakedFills.has(argentHex), `expected the Argent-tinctured crest to bake in its OWN hex (${argentHex}), got ${JSON.stringify([...bakedFills])}`);
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

// ── C1 (final whole-branch review, the LATER merge gate): the og:image must
// unfurl a stripAchievement'd design as a bare shield, not a fully-helmeted
// achievement — mirrors src/export.js's own C1 fix (src/bareShield.js,
// shared). Both polarities: stripped→bare (new here), with-achievement→
// furniture (the test above, unchanged). ──

const TORSE_VIEWBOX_MARKER = '204.998 42.041'; // achievement-art/manifest.js TORSE.viewBox — unique to that asset

test('renderAchievementSVG (stripped design — no achievement key): renders a BARE shield, no helm/torse/mantling furniture, motto as plain text', async () => {
  stubR2Fetch();
  const coat = { field: { tincture: 'Azure' }, charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }], motto: 'Fortis et Fidelis' };
  const svg = await renderAchievementSVG(coat);

  assert.match(svg, /viewBox="0 0 1000 1200"/); // same canvas as the achievement path
  assert.doesNotMatch(svg, new RegExp(TORSE_VIEWBOX_MARKER));
  assert.doesNotMatch(svg, /691\.118 800/); // esquire helm viewBox
  assert.equal(svg.includes('foreignObject'), false);
  assert.equal(svg.includes('Fortis et Fidelis'), true);
  assert.match(svg, new RegExp(`aria-label="${escapeReg(blazon(coat, 'formal'))}"`));

  // The shield's own charge art (lion) still resolves and bakes in — the
  // bare-shield branch reuses the SAME artCache the achievement branch would.
  const countArtSvgs = (s) => (s.match(/viewBox="0 0 100 100"/g) || []).length;
  assert.equal(countArtSvgs(svg), 1);
});

test('renderAchievementSVG: WITH-achievement polarity re-confirmed still renders full furniture (the test above locks the stripped branch; this locks the other one still works alongside it)', async () => {
  stubR2Fetch();
  const svg = await renderAchievementSVG(fullDesign());
  assert.match(svg, new RegExp(TORSE_VIEWBOX_MARKER));
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

// Shared, once-per-process resvg-wasm + font init (mirrors functions/_lib/
// resvg.js's own `ensureReady()` guard) — `initWasm()` throws if called
// twice, and more than one test below renders through resvg-wasm directly
// (bypassing the production lazy-loader), so every such test shares ONE init.
let resvgReadyPromise = null;
function ensureResvgReady() {
  if (!resvgReadyPromise) {
    resvgReadyPromise = (async () => {
      const { Resvg, initWasm } = await import('@resvg/resvg-wasm');
      const wasmBytes = await readFile(fileURLToPath(new URL('../../../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)));
      const fontBytes = await readFile(fileURLToPath(new URL('../../../_lib/fonts/cormorant-garamond-italic-subset.bin', import.meta.url)));
      await initWasm(wasmBytes);
      return { Resvg, fontBytes };
    })();
  }
  return resvgReadyPromise;
}

/** Rasterise a design's real OG SVG (art prefetched, resvg-wasm) to PNG bytes. */
async function renderDesignPng(Resvg, fontBytes, coat) {
  const achievementSVG = await renderAchievementSVG(coat);
  const svg = buildOgSVG(achievementSVG);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { fontBuffers: [new Uint8Array(fontBytes)], loadSystemFonts: false, serifFamily: 'Cormorant Garamond', defaultFontFamily: 'Cormorant Garamond' },
  });
  const png = resvg.render().asPng();
  resvg.free();
  return Buffer.from(png);
}

test('resvg-wasm rasterises the REAL composed OG SVG to a valid PNG (magic bytes, correct dimensions)', async () => {
  stubR2Fetch();
  const { Resvg, fontBytes } = await ensureResvgReady();

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

// C1 live-render confirmation (final whole-branch review): the REAL resvg
// rasterise path, for a stripped design, produces a substantial, valid PNG —
// not a blank/broken/tiny image. This is the automated counterpart to the
// brief's own "render a stripped preset through the real export path and
// Read the PNG" live check (done separately, see the task report).
test('resvg-wasm rasterises a STRIPPED design (no achievement) to a valid, substantial PNG — the bare-shield composition survives the real rasteriser, not just string assertions', async () => {
  stubR2Fetch();
  const { Resvg, fontBytes } = await ensureResvgReady();

  const coat = { field: { tincture: 'Azure' }, charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }], motto: 'Fortis et Fidelis' };
  const png = await renderDesignPng(Resvg, fontBytes, coat);

  assert.deepEqual(Array.from(png.slice(0, 8)), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 5_000, `expected a substantial PNG, got ${png.length} bytes`);

  // The stripped render must NOT be pixel-identical to a full-achievement
  // render of an otherwise-similar coat — a renderer that silently fell back
  // to the achievement composition (the C1 bug) would still pass every
  // string-based markup assertion elsewhere ONLY if the strings differ, but
  // this catches it at the pixel level too, on the SAME rasteriser the
  // production og:image Function actually uses.
  const withAchievementPng = await renderDesignPng(Resvg, fontBytes, fullDesign());
  assert.ok(!png.equals(withAchievementPng), 'expected the stripped (bare-shield) render to differ from the full-achievement render');
});

// Regression guard for the blank-motto bug (task-17-report.md §2 — resvg-wasm
// ships with no fonts, so an unmatched font-family silently rendered zero
// glyphs). The ONLY existing guard against that class of bug was the test
// above's `png.length > 10_000`, which passes whether or not the motto
// renders — the achievement art (shield/helm/torse/crest/supporters) alone
// clears that bar regardless of the motto. This test instead renders two
// otherwise-IDENTICAL designs (same field/charge/achievement) differing ONLY
// in motto text and asserts the resulting PNGs differ: a renderer that
// silently drops the motto (same scroll art, no glyphs, either way) would
// produce byte-IDENTICAL PNGs here, which this test would catch and the
// byte-count check never could.
test('motto text differences produce DIFFERENT rendered PNG bytes — regression guard for the blank-motto bug', async () => {
  stubR2Fetch();
  const { Resvg, fontBytes } = await ensureResvgReady();

  const designWithMotto = (motto) => withDefaultAchievement({
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
    motto,
  });

  const pngA = await renderDesignPng(Resvg, fontBytes, designWithMotto('Fortis et Fidelis'));
  const pngB = await renderDesignPng(Resvg, fontBytes, designWithMotto('Deus Vult'));

  assert.ok(!pngA.equals(pngB), 'expected two designs with different motto text to render different PNG bytes (a blank-motto renderer would make these identical)');
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

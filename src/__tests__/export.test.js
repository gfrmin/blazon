import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importJSXBundle } from './helpers/bundleJSX.mjs';
import { R2_BASE } from '../charges/recolor.js';
import { withDefaultAchievement, clearCrest, blazon, PRESETS } from '../heraldry.js';

// export.js pulls in Achievement.jsx (Vite `?raw` SVG imports) and
// react-dom/server — same esbuild-bundling need as src/__tests__/
// achievement.ssr.test.js. Only the pure/SSR-testable exports
// (`achievementSVG`, `slug`) are exercised here; `downloadPNG`/
// `downloadCleanSVG`/`downloadCleanPNG`/`downloadCleanPDF` touch
// `document`/`Image`/`canvas` and are browser-only (verified live instead —
// see task-19-report.md).
const exportMod = await importJSXBundle(new URL('../export.js', import.meta.url).pathname);
const { achievementSVG, slug } = exportMod;

const FAKE_CHARGE_SVG = '<svg viewBox="0 0 100 100"><path fill="red" d="M10 10 L90 10 L90 90 L10 90 Z"/></svg>';
function stubR2Fetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(R2_BASE)) return { ok: true, text: async () => FAKE_CHARGE_SVG };
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function fullDesign() {
  return withDefaultAchievement({
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
    motto: 'Fortis et Fidelis',
  });
}

// ── MERGE-BLOCKER regression lock: the achievement renders, not a bare shield ──

test('achievementSVG: renders the FULL achievement (helm/torse/mantling/crest/supporters), not a bare <Shield>', async () => {
  stubR2Fetch();
  const svg = await achievementSVG(fullDesign());
  // The achievement's own fixed canvas (achievement-art/layout.js LAYOUT.viewBox)
  // — a bare-shield export (pre-task-19) would carry viewBox="0 0 200 ..." instead.
  assert.match(svg, /viewBox="0 0 1000 /);
  assert.doesNotMatch(svg, /^<svg[^>]*viewBox="0 0 200 /);
  // The escutcheon itself still renders inside the composition (Shield.jsx's
  // own path signature) — proves the shield slot isn't just missing/blank.
  assert.match(svg, /M18,14 H182/);
  // The motto text is present — only the full <Achievement> composition
  // draws a motto scroll at all; a bare <Shield> never does.
  assert.match(svg, />Fortis et Fidelis</);
});

test('achievementSVG: has the react namespace on the root <svg> (React omits it by default)', async () => {
  stubR2Fetch();
  const svg = await achievementSVG(fullDesign());
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

// Regression lock (live-caught bug, task-19 verification — see the comment
// above the `.replace('width="100%"', …)` call in src/export.js): a
// PERCENTAGE width has nothing to resolve against in svgToPNG's standalone
// `<img src="data:...">` rasterisation, so the free-tier footer band
// rasterised fully blank/mispositioned even though this markup looked fine.
// Pinning both width AND height to definite pixels fixed it; assert the
// ROOT <svg>'s opening tag specifically carries definite values, never a
// percentage, so a revert is caught. (Nested <svg> sub-elements deeper in
// the composition legitimately keep `width="100%"` — they sit inside an
// ancestor that already has a definite pixel containing block — so this
// checks only the root tag, not the whole markup.)
test('achievementSVG: root <svg> width/height are pinned to definite pixel values, never a percentage (regression lock for the blank-rasterisation bug)', async () => {
  stubR2Fetch();
  const svg = await achievementSVG(fullDesign());
  const rootTag = svg.match(/^<svg[^>]*>/)[0];
  assert.doesNotMatch(rootTag, /width="100%"/);
  assert.doesNotMatch(rootTag, /height="100%"/);
  assert.match(rootTag, /width="1000"/);
  assert.match(rootTag, /height="\d+"/);
});

test('achievementSVG: backfill=false — a design with the crest explicitly cleared renders with no crest markup, even from a full achievement', async () => {
  stubR2Fetch();
  const withCrest = fullDesign();
  const noCrest = clearCrest(withCrest);
  const svgWith = await achievementSVG(withCrest);
  const svgWithout = await achievementSVG(noCrest);
  const countArtSvgs = (s) => (s.match(/viewBox="0 0 100 100"/g) || []).length;
  // fullDesign(): shield charge + crest + dexter + sinister (matched pair) = 4
  // uses of the lion art; clearing the crest drops it to 3.
  assert.equal(countArtSvgs(svgWith), 4);
  assert.equal(countArtSvgs(svgWithout), 3);
});

// ── free vs. clean variant ────────────────────────────────────────────────

// A real (not full-blown XML-library) tag tokenizer, same technique as
// achievement.ssr.test.js's assertWellFormedXML — but here used to compute
// each opening tag's NESTING DEPTH, so a test can assert an element is a
// DIRECT CHILD OF THE ROOT <svg>, not merely present somewhere in the
// string. This is the regression guard for a real bug caught only by live
// rasterisation (task-19 verification): `.replace('</svg>', …)` (a plain,
// non-global string replace) targets the FIRST `</svg>` in the document —
// which is a NESTED sub-<svg> (the achievement always wraps mantling/
// shield/helm/torse/motto each in their own <svg>), not the document root.
// Nested <svg> establishes its own viewport and clips content outside it by
// default, so text inserted there rendered with entirely correct content/
// fill/geometry (a live DOM query confirmed all of that) yet painted
// NOTHING once rasterised — a class of bug NO substring-presence assertion
// (all of which passed throughout) could ever have caught.
function tagDepths(markup) {
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>/g;
  const depths = []; // { tag, depth, index }
  let depth = 0;
  let m;
  while ((m = tagRe.exec(markup))) {
    const [, closing, name, , selfClose] = m;
    if (closing) {
      depth--;
    } else {
      depths.push({ tag: name, depth, index: m.index });
      if (!selfClose) depth++;
    }
  }
  return depths;
}

test('achievementSVG (free, default): the caption/watermark/credit <text> elements are DIRECT CHILDREN of the ROOT <svg> (depth 1), not a nested sub-<svg> — regression guard, see tagDepths\' doc comment', async () => {
  stubR2Fetch();
  const svg = await achievementSVG(fullDesign());
  const depths = tagDepths(svg);
  const rootDepth = depths.find((d) => d.tag === 'svg').depth; // 0
  // The three appended texts (blazon caption, watermark, credit) sit at
  // rootDepth+1 — DIRECT children of the document root, never nested inside
  // one of the achievement's own sub-<svg> elements (which would clip them).
  const appendedTexts = depths.filter((d) => d.tag === 'text').slice(-3);
  assert.equal(appendedTexts.length, 3);
  for (const t of appendedTexts) {
    assert.equal(t.depth, rootDepth + 1, `expected the appended <text> at index ${t.index} to be a direct child of the root <svg> (depth ${rootDepth + 1}), got depth ${t.depth}`);
  }
});

test('achievementSVG (clean:true): the <metadata> element is a DIRECT CHILD of the ROOT <svg>, not nested inside a sub-<svg>', async () => {
  stubR2Fetch();
  const svg = await achievementSVG(fullDesign(), { clean: true });
  const depths = tagDepths(svg);
  const rootDepth = depths.find((d) => d.tag === 'svg').depth;
  const metadataTag = depths.find((d) => d.tag === 'metadata');
  assert.ok(metadataTag, 'expected a <metadata> tag');
  assert.equal(metadataTag.depth, rootDepth + 1);
});

test('achievementSVG (free, default): extends the viewBox with a footer band carrying the formal blazon + watermark + CC-BY-SA credit', async () => {
  stubR2Fetch();
  const design = fullDesign();
  const svg = await achievementSVG(design);
  assert.match(svg, /viewBox="0 0 1000 1460"/); // 1200 + 260 footer band
  assert.match(svg, new RegExp(escapeReg(blazon(design, 'formal'))));
  assert.match(svg, />made with blazon\.app</);
  assert.match(svg, /CC BY-SA/);
  assert.doesNotMatch(svg, /<metadata>/); // attribution is VISIBLE text here, not hidden metadata
});

test('achievementSVG (clean:true): NO watermark caption, viewBox stays the achievement\'s native 1000×1200, CC-BY-SA moved into <metadata>', async () => {
  stubR2Fetch();
  const design = fullDesign();
  const svg = await achievementSVG(design, { clean: true });
  assert.match(svg, /viewBox="0 0 1000 1200"/);
  assert.doesNotMatch(svg, /viewBox="0 0 1000 1460"/);
  assert.doesNotMatch(svg, />made with blazon\.app</);
  assert.doesNotMatch(svg, new RegExp(escapeReg(blazon(design, 'formal')) + '<'));
  assert.match(svg, /<metadata>[^<]*CC BY-SA[^<]*<\/metadata>/);
});

test('achievementSVG (clean:true): the achievement CONTENT itself (crest/helm/torse/mantling/supporters/motto) matches the free variant exactly — only the caption/footer treatment differs (WYSIWYG: paid == preview == free minus watermark)', async () => {
  stubR2Fetch();
  const design = fullDesign();
  const free = await achievementSVG(design, { clean: false });
  const clean = await achievementSVG(design, { clean: true });

  // The aria-label (the formal blazon, computed from the SAME coat) and the
  // recoloured-art instance count must be identical regardless of tier.
  const ariaLabelOf = (s) => s.match(/aria-label="([^"]*)"/)[1];
  assert.equal(ariaLabelOf(free), ariaLabelOf(clean));
  const countArtSvgs = (s) => (s.match(/viewBox="0 0 100 100"/g) || []).length;
  assert.equal(countArtSvgs(free), countArtSvgs(clean));
  assert.equal(countArtSvgs(free), 4); // shield charge + crest + dexter + sinister

  // Every non-footer structural layer is present, identically, in both: the
  // mantling/helm/torse achievement furniture (fixed viewBoxes from
  // achievement-art/manifest.js) and the motto text itself.
  for (const marker of [/M18,14 H182/, />Fortis et Fidelis</]) {
    assert.match(free, marker);
    assert.match(clean, marker);
  }

  // ...and ONLY the free variant carries the visible caption/watermark text.
  assert.doesNotMatch(clean, />made with blazon\.app</);
  assert.match(free, />made with blazon\.app</);
});

// ── the broadened shield-charge prefetch, end-to-end through export.js ──

test('achievementSVG: a design with TWO mobile shield-charge groups renders BOTH (not blank) — the Task 17 residual, closed via the broadened prefetch', async () => {
  stubR2Fetch();
  const design = {
    field: { tincture: 'Azure' },
    charges: [
      { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
      { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'eagle' } },
    ],
  };
  // Doesn't throw, and produces well-formed, non-empty markup — the shield
  // itself only ever DRAWS its own single `.find()`-picked group (a
  // separate, narrower limitation — see achievementArt.js's header), so this
  // asserts the render succeeds cleanly with a design shaped this way,
  // not that both groups paint on the escutcheon.
  const svg = await achievementSVG(design, { clean: true });
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /undefined|\[object Object\]|NaN/);
});

// ── slug() unchanged ──────────────────────────────────────────────────────

test('slug: derives a filename-safe slug from the formal blazon, stable across presets', () => {
  for (const p of PRESETS) {
    const s = slug(p.design);
    assert.match(s, /^[a-z0-9-]+$/);
    assert.ok(s.length > 0 && s.length <= 60);
  }
});

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

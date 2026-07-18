// Vendor DrawShield's achievement-furniture SVGs (helmets, torse, mantling,
// motto scrolls, a token compartment) — GPL-3.0 code, individual art often
// CC-BY-SA (Wikimedia Commons). Unlike src/charges/ (2,108 files, hosted on
// R2 because the long tail is huge), this is a few dozen files that are
// *always* needed to draw a full achievement, so they're bundled in-repo
// under src/achievement-art/ rather than fetched from object storage.
//
// SELECTIVE vendoring (approved scope decision — see .superpowers/sdd/briefs/
// task-8-brief.md §VERIFIED UPSTREAM FINDINGS): the full svg/components tree
// is 10.35 MB, dominated by 10 heavy continental mantling variants (napoleanic,
// prince-hre, grandee-of-spain, peer-of-france, cloak-pavilion — up to ~1.2 MB
// EACH, raw). MVP needs one mantling recoloured to livery tinctures, not
// fifteen. We vendor: all 5 helmets (rank-meaningful), the 1 torse, the
// plainest standard mantling (the classic slashed "cloak" drape), two motto
// scrolls (above/below placement) that carry id="textPath", and one cheap
// compartment as a token/testbed (compartments are OFF by default in MVP).
// ornaments/fringes/crown-as-worn are skipped entirely (unused this milestone).
// motto/plaque.svg is skipped: it's a bare <g> fragment with NO id="textPath"
// (it's a solid tablet, lettered by centring, not text-on-a-path) and has no
// root <svg> — out of scope for "motto scroll" per the brief.
//
// Uses the SAME fetch + RDF-attribution-capture conventions as
// scripts/vendor-charges.mjs, but a SEPARATE svgo config
// (scripts/svgo-achievement.config.mjs, cleanupIds:false — see that file's
// header for why) because DrawShield recolours mantling/torse BY ELEMENT ID
// (e.g. "dexter1-1", "tincture2-3") and every motto scroll's text-path is
// id="textPath". The shared scripts/svgo.config.mjs strips all ids
// (cleanupIds is part of preset-default) — silently fine for charges (no
// per-id recolouring), silently fatal here.
//
// Re-runnable: re-fetches + re-optimizes every listed file each run and
// merges attribution.json + ATTRIBUTION.md idempotently (replaces the marked
// section rather than appending duplicates).
//
//   node scripts/vendor-components.mjs
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = 'https://raw.githubusercontent.com/drawshield/Drawshield-Code/stable/svg/components';
const OUT_DIR = join(__dirname, '..', 'src', 'achievement-art');
const SVGO_CONFIG = join(__dirname, 'svgo-achievement.config.mjs');
const ATTRIBUTION_MD = join(__dirname, '..', 'ATTRIBUTION.md');

// Selected files. `expectIds`: recolour/textPath ids that MUST survive svgo —
// checked after optimization; a missing id fails the run loudly (this is the
// exact failure mode the separate svgo config exists to prevent).
const FILES = [
  { dir: 'helmet', name: 'royal', kind: 'helmet', rank: 'royal' },
  { dir: 'helmet', name: 'peer', kind: 'helmet', rank: 'peer' },
  { dir: 'helmet', name: 'baronet', kind: 'helmet', rank: 'baronet' },
  { dir: 'helmet', name: 'knight', kind: 'helmet', rank: 'knight' },
  { dir: 'helmet', name: 'esquire', kind: 'helmet', rank: 'esquire' },
  {
    dir: 'torse', name: 'torse', kind: 'torse',
    expectIds: ['tincture1-1', 'tincture1-2', 'tincture1-3', 'tincture2-1', 'tincture2-2', 'tincture2-3'],
    recolorIds: {
      colour: ['tincture1-1', 'tincture1-2', 'tincture1-3'],
      metal: ['tincture2-1', 'tincture2-2', 'tincture2-3'],
    },
  },
  {
    dir: 'mantling', name: 'cloak', kind: 'mantling',
    expectIds: ['dexter1-1', 'dexter2-1', 'sinister1-1', 'sinister2-1'],
    recolorIds: {
      colour: ['dexter1-1', 'sinister1-1'],
      metal: ['dexter2-1', 'sinister2-1'],
    },
  },
  { dir: 'motto', name: 'scroll-above', kind: 'motto', placement: 'above', expectIds: ['textPath'], textPathId: 'textPath' },
  { dir: 'motto', name: 'scroll-below', kind: 'motto', placement: 'below', expectIds: ['textPath'], textPathId: 'textPath' },
  { dir: 'compartments', name: 'pedestal', kind: 'compartment' },
];

function attribution(svg) {
  const creator = svg.match(/<dc:creator>[\s\S]*?<dc:title>([^<]*)<\/dc:title>/i)?.[1]?.trim();
  const licenseUrl = svg.match(/<cc:license[^>]*rdf:resource="([^"]*)"/i)?.[1]
    || svg.match(/(https?:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^\s"'<]+)/i)?.[1]
    || svg.match(/(https?:\/\/[^\s"'<]*\/licenses\/[a-z-]+\/[0-9.]+[^\s"'<]*)/i)?.[1];
  const rights = svg.match(/<dc:rights>[\s\S]*?<dc:title>([^<]*)<\/dc:title>/i)?.[1]?.trim();
  return {
    artist: creator || 'Unknown (Wikimedia Commons via DrawShield)',
    license: licenseUrl || rights || 'CC BY-SA (Wikimedia Commons; treat as share-alike)',
    source: (creator && /^https?:\/\//.test(creator)) ? creator : 'https://drawshield.net',
  };
}

// Ensure a viewBox (from width/height) BEFORE svgo runs, same as
// vendor-all-charges.mjs — none of the upstream files carry one.
function ensureViewBox(svg) {
  if (/viewBox=/i.test(svg)) return svg;
  const w = svg.match(/<svg[^>]*\bwidth="([\d.]+)/i)?.[1];
  const h = svg.match(/<svg[^>]*\bheight="([\d.]+)/i)?.[1];
  return (w && h) ? svg.replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}"`) : svg;
}

const viewBoxOf = (svg) => svg.match(/viewBox="([^"]*)"/i)?.[1] || null;

console.log(`fetching ${FILES.length} achievement-furniture files…\n`);
const attrib = {};
const fetched = [];
for (const f of FILES) {
  const key = `${f.dir}/${f.name}`;
  try {
    const res = await fetch(`${REPO}/${f.dir}/${f.name}.svg`);
    if (!res.ok) { console.log(`  ✘ ${key} → HTTP ${res.status}`); continue; }
    const raw = await res.text();
    attrib[key] = attribution(raw);
    const withViewBox = ensureViewBox(raw);
    const outDir = join(OUT_DIR, f.dir);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `${f.name}.svg`);
    writeFileSync(outPath, withViewBox);
    fetched.push({ ...f, outPath, key });
    console.log(`  ✓ ${key}  ${(withViewBox.length / 1024).toFixed(1)}kb raw`);
  } catch (e) {
    console.log(`  ✘ ${key} → ${e.message}`);
  }
}

if (fetched.length === 0) {
  console.error('\nNo files fetched — aborting before svgo/manifest/attribution.');
  process.exit(1);
}

console.log(`\noptimizing with svgo (${SVGO_CONFIG})…`);
// NOTE: current npx-fetched svgo (v4) prints a benign warning —
// "You are trying to configure removeViewBox which is not part of
// preset-default" — for BOTH this config and the pre-existing shared
// scripts/svgo.config.mjs (same override shape); exit code is 0 and the
// viewBox is retained either way. Not something introduced here.
execFileSync('npx', ['svgo', '-f', OUT_DIR, '-r', '--config', SVGO_CONFIG, '-q'], { stdio: 'inherit' });

console.log('\nverifying ids survived svgo (the failure mode the achievement config exists to prevent)…');
const assets = [];
let idFailures = 0;
for (const f of fetched) {
  const svg = readFileSync(f.outPath, 'utf8');
  const vb = viewBoxOf(svg);
  if (!vb) {
    console.error(`  ✘ ${f.key}: no viewBox survived svgo!`);
    idFailures++;
  }
  if (f.expectIds) {
    const missing = f.expectIds.filter((id) => !svg.includes(`id="${id}"`));
    if (missing.length) {
      console.error(`  ✘ ${f.key}: missing ids after svgo: ${missing.join(', ')}`);
      idFailures++;
    } else {
      console.log(`  ✓ ${f.key}: ids survived [${f.expectIds.join(', ')}]  vb[${vb}]  ${(svg.length / 1024).toFixed(1)}kb`);
    }
  } else {
    console.log(`  ✓ ${f.key}: vb[${vb}]  ${(svg.length / 1024).toFixed(1)}kb`);
  }
  assets.push({
    key: f.name, dir: f.dir, kind: f.kind, path: `${f.dir}/${f.name}.svg`,
    viewBox: vb,
    ...(f.rank ? { rank: f.rank } : {}),
    ...(f.placement ? { placement: f.placement } : {}),
    ...(f.recolorIds ? { recolorIds: f.recolorIds } : {}),
    ...(f.textPathId ? { textPathId: f.textPathId } : {}),
    license: attrib[f.key],
  });
}
if (idFailures) {
  console.error(`\n${idFailures} asset(s) failed id/viewBox verification after svgo — aborting.`);
  process.exit(1);
}

// --- manifest.js (data-only: no import.meta.glob / ?raw here, so this loads
// fine under plain `node --test` as well as under Vite; the raw-SVG-text
// import happens in the CONSUMING component via Vite's `?raw` suffix, e.g.
//   import svg from '../achievement-art/helmet/royal.svg?raw'
// or, to pull every file's text at once:
//   import.meta.glob('../achievement-art/**/*.svg', { query: '?raw', import: 'default', eager: true })
// `path` above is relative to this src/achievement-art/ directory. ---
const byKind = (k) => assets.filter((a) => a.kind === k);
const manifestSrc = `// Generated by scripts/vendor-components.mjs — DO NOT hand-edit.
// Metadata for the bundled achievement-furniture SVGs (helmets, torse,
// mantling, motto scrolls, a token compartment) vendored from DrawShield's
// svg/components/ tree. Unlike src/charges (2,108 files on R2), these ~10
// files are always needed to draw a full achievement, so they're bundled
// in-repo rather than fetched from object storage.
//
// This module is intentionally Vite-agnostic (no import.meta.glob / ?raw) so
// it loads under plain \`node --test\` as well as under Vite. \`path\` is
// relative to this file's directory (src/achievement-art/) — import the raw
// SVG text at build time with Vite's \`?raw\` suffix, e.g.:
//   import svg from './achievement-art/helmet/royal.svg?raw'
// or, to pull every file's text at once:
//   import.meta.glob('./achievement-art/**/*.svg', { query: '?raw', import: 'default', eager: true })
//
// recolorIds.colour / recolorIds.metal: element ids whose fill DrawShield
// swaps for the shield's first colour / first metal tincture respectively
// (mantling matches the field's principal colour, lined with the principal
// metal; the torse alternates the same two tinctures in 3+3 twists).
// textPathId: the id of the <path> a <textPath> should reference to letter
// the motto along the scroll's curve.

export const HELMETS = ${JSON.stringify(byKind('helmet'), null, 2)};

export const TORSE = ${JSON.stringify(byKind('torse')[0] || null, null, 2)};

export const MANTLING = ${JSON.stringify(byKind('mantling'), null, 2)};

export const MOTTOS = ${JSON.stringify(byKind('motto'), null, 2)};

export const COMPARTMENTS = ${JSON.stringify(byKind('compartment'), null, 2)};

// All assets, flat — keyed by "dir/key" (matches attribution.json's keys).
export const ACHIEVEMENT_ART = ${JSON.stringify(assets, null, 2)};

export const findByKey = (dir, key) => ACHIEVEMENT_ART.find((a) => a.dir === dir && a.key === key) || null;
`;
writeFileSync(join(OUT_DIR, 'manifest.js'), manifestSrc);
console.log(`\nwrote src/achievement-art/manifest.js (${assets.length} assets)`);

// --- attribution.json (merge, keyed by "dir/name" — same shape as
// src/charges/attribution.json) ---
const attribPath = join(OUT_DIR, 'attribution.json');
const existingAttrib = existsSync(attribPath) ? JSON.parse(readFileSync(attribPath, 'utf8')) : {};
const mergedAttrib = { ...existingAttrib, ...attrib };
writeFileSync(attribPath, JSON.stringify(mergedAttrib, null, 2));
console.log(`wrote src/achievement-art/attribution.json (${Object.keys(mergedAttrib).length} entries)`);

// --- ATTRIBUTION.md: idempotent merge via a marked section, so re-running
// this script replaces the section instead of appending duplicates. ---
const BEGIN = '<!-- BEGIN achievement-furniture-credits (generated by scripts/vendor-components.mjs) -->';
const END = '<!-- END achievement-furniture-credits -->';
const sortedKeys = Object.keys(mergedAttrib).sort();
const rows = sortedKeys.map((k) => `| \`${k}\` | ${mergedAttrib[k].artist} | ${mergedAttrib[k].license} |`).join('\n');
const section = `${BEGIN}
## Achievement furniture credits (${sortedKeys.length})

Helmets, torse, mantling, motto scrolls, and a token compartment — bundled in-repo
under \`src/achievement-art/\` (not R2, unlike the charge library above) because
they're always needed to draw a full achievement. Same source (DrawShield /
Wikimedia Commons) and licensing posture as the charges: predominantly CC BY-SA,
treated as share-alike where no per-file licence is captured. Generated by
\`scripts/vendor-components.mjs\`.

| Asset (dir/name) | Creator / source | Licence (as captured) |
|---|---|---|
${rows}
${END}`;

let md = readFileSync(ATTRIBUTION_MD, 'utf8');
if (md.includes(BEGIN) && md.includes(END)) {
  const before = md.slice(0, md.indexOf(BEGIN));
  const after = md.slice(md.indexOf(END) + END.length);
  md = `${before}${section}${after}`;
} else {
  md = `${md.trimEnd()}\n\n${section}\n`;
}
writeFileSync(ATTRIBUTION_MD, md);
console.log('merged achievement-furniture credits into ATTRIBUTION.md');

const totalBytes = assets.reduce((sum, a) => {
  const svg = readFileSync(join(OUT_DIR, a.path), 'utf8');
  return sum + Buffer.byteLength(svg, 'utf8');
}, 0);
console.log(`\ndone. ${assets.length} assets, ${(totalBytes / 1024).toFixed(1)} KB post-svgo total.`);
if (totalBytes > 1.5 * 1024 * 1024) {
  console.log('⚠ exceeds ~1.5 MB bundling budget — consider lazy-loading achievement art.');
}

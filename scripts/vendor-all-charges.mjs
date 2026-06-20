// Process the full DrawShield charge library for R2 hosting.
//
//   git clone --depth 1 https://github.com/drawshield/Drawshield-Code /tmp/ds-clone
//   node scripts/vendor-all-charges.mjs /tmp/ds-clone/svg/charges /tmp/charges-r2
//   npx svgo -rf /tmp/charges-r2/charges --config scripts/svgo.config.mjs
//   rclone copy /tmp/charges-r2/charges r2:blazon-assets/charges --transfers 32
//
// Captures attribution from each SVG's RDF metadata BEFORE optimization strips
// it, ensures a viewBox (so the art scales), and emits catalog.json (key → path)
// + attribution.json. Skips non-heraldic / IP categories.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const SRC = process.argv[2] || '/tmp/ds-clone/svg/charges';
const OUT = process.argv[3] || '/tmp/charges-r2';
const SKIP_PATH = /(^|\/)(proper|custom|submissions)(\/|$)/;
// IP / non-heraldic categories. (Note: 'game' = heraldic game animals — KEPT;
// 'games' = chess/backgammon — skipped. 'quadrate' = crosses/compass-stars — KEPT.)
const SKIP_CAT = new Set([
  'warhammer', 'retro-scifi', 'characters', 'playing-card', // IP / franchise
  'games', 'modern', 'sports', 'prehistoric',               // non-traditional
  'shogun', 'norse',                                        // non-Western (out of V1 scope)
  'special',
]);

function walk(d) {
  let out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.svg')) out.push(p);
  }
  return out;
}

function attribution(svg) {
  const creator = svg.match(/<dc:creator>[\s\S]*?<dc:title>([^<]*)<\/dc:title>/i)?.[1]?.trim();
  const license = svg.match(/<cc:license[^>]*rdf:resource="([^"]*)"/i)?.[1]
    || svg.match(/(https?:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^\s"'<]+)/i)?.[1];
  return {
    artist: creator || 'Wikimedia Commons via DrawShield',
    license: license || 'CC BY-SA (Wikimedia Commons; treat as share-alike)',
  };
}

function ensureViewBox(svg) {
  if (/viewBox=/i.test(svg)) return svg;
  const w = svg.match(/<svg[^>]*\bwidth="([\d.]+)/i)?.[1];
  const h = svg.match(/<svg[^>]*\bheight="([\d.]+)/i)?.[1];
  return (w && h) ? svg.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`) : svg;
}

const files = walk(SRC).filter((f) => {
  const rel = relative(SRC, f);
  return !SKIP_PATH.test(rel) && !SKIP_CAT.has(rel.split('/')[0]);
});

const catalog = {};   // key → "category/name"
const attrib = {};    // "category/name" → { artist, license }
const seen = new Set();
let n = 0;
for (const f of files) {
  const rel = relative(SRC, f).replace(/\.svg$/, '');
  const cat = rel.split('/')[0];
  const base = rel.split('/').pop();
  let key = base;
  if (seen.has(key)) key = `${cat}-${base}`;
  if (seen.has(key)) continue; // give up on rare double-collision
  seen.add(key);

  const raw = readFileSync(f, 'utf8');
  const outRel = `charges/${rel}.svg`;
  const outPath = join(OUT, outRel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, ensureViewBox(raw));
  catalog[key] = rel;
  attrib[rel] = attribution(raw);
  n++;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog));
writeFileSync(join(OUT, 'attribution.json'), JSON.stringify(attrib, null, 0));
console.log(`processed ${n} charges → ${OUT}/charges/  (catalog.json + attribution.json)`);

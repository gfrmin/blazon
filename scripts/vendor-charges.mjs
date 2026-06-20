// Vendor DrawShield's GPL/CC-BY-SA charge SVGs into public/charges/.
//
// Fetches each listed charge from the DrawShield repo, captures attribution
// (creator/license/source from the embedded RDF metadata), strips Inkscape
// cruft while keeping the drawable paths + a viewBox, and writes a cleaned SVG.
// Also writes public/charges/attribution.json. Re-run to add more batches.
//
//   node scripts/vendor-charges.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const REPO = 'https://raw.githubusercontent.com/drawshield/Drawshield-Code/stable/svg/charges';
const OUT = new URL('../public/charges/', import.meta.url);

// DrawShield repo paths (category/file, no extension) to vendor in this batch.
const FILES = [
  'lion/lion-rampant', 'lion/lion-passant', 'lion/lion-passant-guardant', 'lion/lion-statant',
  'lion/lion-sejant', 'lion/lion-salient', 'lion/lion-couchant', 'lion/lion-dormant',
  'bear/bear-rampant', 'bear/bear-passant', 'bear/bear-passant-guardant', 'bear/bear-sejant',
  'bear/bear-couchant', 'bear/bear-dormant',
  'wildlife/wolf', 'game/stag', 'game/boar', 'livestock/horse',
  'mythical/griffin', 'dragon/dragon',
  'eagle/eagle', 'hawking/falcon', 'bird/martlett', 'bird/martlett-volant',
  'fish/fish', 'sealife/dolphin',
  'emblem/fleur-de-lys', 'flower/rose', 'sealife/escallop', 'ship/anchor',
  'architecture/tower', 'sword/arming-sword', 'tools/key',
];

const base = (p) => p.split('/').pop();

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

function clean(svg) {
  let s = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/gi, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/\s(?:inkscape|sodipodi):[\w-]+="[^"]*"/gi, '')
    .replace(/\sxmlns:(?:inkscape|sodipodi|rdf|cc|dc)="[^"]*"/gi, '')
    .replace(/<defs[^>]*\/>/gi, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  // Ensure a viewBox so the art scales when placed.
  if (!/viewBox=/i.test(s)) {
    const w = s.match(/<svg[^>]*\bwidth="([\d.]+)/i)?.[1];
    const h = s.match(/<svg[^>]*\bheight="([\d.]+)/i)?.[1];
    if (w && h) s = s.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }
  return s;
}

function fills(svg) {
  return [...new Set([...svg.matchAll(/fill:\s*(#[0-9a-f]{3,6}|none)/gi)].map((m) => m[1].toLowerCase())
    .concat([...svg.matchAll(/fill="(#[0-9a-f]{3,6}|none)"/gi)].map((m) => m[1].toLowerCase())))];
}

mkdirSync(OUT, { recursive: true });
const attrib = {};
console.log(`fetching ${FILES.length} charges…\n`);
for (const p of FILES) {
  const name = `${base(p)}.svg`;
  try {
    const res = await fetch(`${REPO}/${p}.svg`);
    if (!res.ok) { console.log(`  ✘ ${p} → HTTP ${res.status}`); continue; }
    const raw = await res.text();
    const cleaned = clean(raw);
    attrib[name] = attribution(raw);
    const outPath = new URL(name, OUT);
    mkdirSync(dirname(outPath.pathname), { recursive: true });
    writeFileSync(outPath, cleaned);
    const vb = cleaned.match(/viewBox="([^"]*)"/i)?.[1] || '(none)';
    console.log(`  ✓ ${name}  vb[${vb}]  fills[${fills(cleaned).join(' ')}]  ${(cleaned.length / 1024).toFixed(1)}kb`);
  } catch (e) {
    console.log(`  ✘ ${p} → ${e.message}`);
  }
}
writeFileSync(new URL('attribution.json', OUT), JSON.stringify(attrib, null, 2));
console.log(`\nwrote ${Object.keys(attrib).length} files + attribution.json to public/charges/`);

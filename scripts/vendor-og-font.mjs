// ─────────────────────────────────────────────────────────────────────────
// ONE-TIME vendoring script for functions/_lib/fonts/cormorant-garamond-
// italic-subset.bin — NOT run automatically by any npm script (unlike
// scripts/build-achievement-bundle.mjs), same as scripts/vendor-
// components.mjs. Shells out to `fonttools`/`pyftsubset` (Python), which
// this JS project does not otherwise depend on — that's WHY this is a
// manual, occasionally-run vendoring step with a COMMITTED output, not part
// of the routine build/test pipeline. Run with: node scripts/vendor-og-font.mjs
//
// WHY THIS EXISTS (task-17): resvg-wasm ships with no bundled/system fonts
// in the Pages Functions runtime (no OS font store to fall back to), so
// Achievement.jsx's motto <textPath> — styled `font-family="Cormorant
// Garamond, Georgia, serif"` — rasterised to BLANK (no glyphs, no error;
// confirmed directly, see task-17-report.md). resvg's `ResvgRenderOptions.
// font.fontBuffers` lets us hand it an actual font's bytes; setting
// `serifFamily`/`defaultFontFamily` to match means the SVG's own trailing
// generic `serif` keyword resolves to it once "Cormorant Garamond" and
// "Georgia" both fail to match (standard CSS font-family fallback, which
// resvg implements) — confirmed working, see functions/_lib/resvg.js.
//
// Steps: fetch the variable font (Cormorant Garamond ships ONLY as a
// variable font upstream — no static instances) → instantiate the default
// (400, Regular) weight (454 KB, ~35% smaller than the variable original,
// and resvg doesn't need to negotiate a variable axis at all this way) →
// subset to Basic Latin + Latin-1 Supplement + Latin Extended-A (covers
// English and the common Western-European accented mottos) + curly
// quotes/dashes, hinting stripped (454 KB → 80 KB) → write the `.bin`
// (Cloudflare's Functions bundler recognises `.bin` as a Data/ArrayBuffer
// module natively; it does NOT recognise `.ttf` — confirmed directly, see
// functions/_lib/resvg.js's header).
//
// LICENSE: Cormorant Garamond is SIL Open Font License 1.1
// (functions/_lib/fonts/OFL.txt, vendored alongside per the OFL's own
// redistribution terms) — free to use, subset, and embed. This subset is
// baked into the server-rendered og:image only; never served to end users
// as a downloadable font file.
// ─────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'functions/_lib/fonts/cormorant-garamond-italic-subset.bin');
const SRC_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf';
const UNICODES = 'U+0020-007E,U+00A0-017F,U+2018-201F,U+2013-2014';

for (const [bin, args] of [['fonttools', []], ['pyftsubset', ['--help']]]) {
  try {
    execFileSync(bin, args, { stdio: 'ignore' });
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`Missing "${bin}" on PATH — install fonttools (e.g. \`pip install fonttools\`) and re-run.`);
      process.exit(1);
    }
    // Any other exit (e.g. a bare "fonttools" with no subcommand still
    // exits non-zero) just means the binary IS present — fine, continue.
  }
}

async function main() {
  const tmp = await mkdtemp(path.join(tmpdir(), 'blazon-og-font-'));
  try {
    console.log(`fetching ${SRC_URL}`);
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const varPath = path.join(tmp, 'cg-italic-var.ttf');
    await writeFile(varPath, new Uint8Array(await res.arrayBuffer()));

    const instancePath = path.join(tmp, 'cg-italic-400.ttf');
    console.log('instantiating default weight (400)');
    execFileSync('fonttools', ['varLib.instancer', varPath, 'wght=400', '-o', instancePath], { stdio: 'inherit' });

    console.log('subsetting');
    execFileSync(
      'pyftsubset',
      [
        instancePath,
        `--output-file=${OUT}`,
        `--unicodes=${UNICODES}`,
        '--no-hinting',
        '--desubroutinize',
        "--layout-features=kern,liga,calt",
      ],
      { stdio: 'inherit' },
    );
    console.log(`wrote ${path.relative(ROOT, OUT)}`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

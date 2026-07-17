// ─────────────────────────────────────────────────────────────────────────
// resvg-wasm loader — rasterises an SVG string to PNG bytes for the og:image
// (functions/api/og/[payload].js). @resvg/resvg-wasm is the ONE new
// dependency this task (task-17) adds.
//
// WASM LOADING (the fiddly part, confirmed working live — see
// task-17-report.md): Cloudflare's Pages/Workers bundler (the esbuild pass
// wrangler runs over ./functions) natively understands a plain ESM import of
// a `.wasm` file — `import wasmModule from '….wasm'` resolves to a
// `WebAssembly.Module` (already-compiled, not a Promise, not raw bytes).
// `initWasm()`'s own typedef accepts exactly that
// (`InitInput = RequestInfo | URL | Response | BufferSource |
// WebAssembly.Module`), so no fetch, no `[[wasm_modules]]` binding, and no
// wrangler.toml/compatibility-flag config is needed at all — verified with
// `npx wrangler pages dev` serving a real PNG from this exact import
// pattern before any of the rest of this task was built (the highest-risk,
// do-this-first check per the brief's escalation instruction).
//
// FONT (found live, fixed live — see task-17-report.md): resvg-wasm ships
// with NO bundled/system fonts in this runtime (no OS font store to fall
// back to) — a first real render of a design WITH a motto came back with a
// visibly blank motto scroll (shield/crest/supporters all fine; only the
// <text><textPath> silently produced zero glyphs, no error). Fixed the same
// way as the wasm binary itself: a `.bin` ESM import of a vendored,
// subsetted Cormorant-Garamond-Italic font (functions/_lib/fonts/, SIL OFL
// 1.1 — see scripts/vendor-og-font.mjs for the exact fetch/instance/subset
// recipe and functions/_lib/fonts/OFL.txt for the license), fed to resvg via
// `font.fontBuffers` with `serifFamily`/`defaultFontFamily` set to match —
// the motto's own `font-family="Cormorant Garamond, Georgia, serif"` falls
// through to the trailing generic `serif` keyword once the first two names
// don't match anything loaded (standard CSS font-family fallback, which
// resvg implements), which then resolves to the embedded font.
//
// Both loaded lazily (dynamic import, not a static top-level one): keeps
// the `.wasm`/`.bin` module loads OUT of this module's own evaluation —
// importing this file (and anything that imports it, e.g.
// functions/api/og/[payload].js) never touches either binary until
// `svgToPng` is actually CALLED. That matters for tests: plain `node --test`
// can import this file (and exercise every code path that returns before
// rasterising, e.g. the bad-payload redirect in the og Function) without
// needing Node's own WASM-as-ESM support at all — which, for this
// particular wasm-bindgen-produced module, doesn't actually work under
// plain Node regardless of static/dynamic (confirmed directly: Node's
// native loader can't resolve the wasm module's own `wbg` glue imports —
// see task-17-report.md for the full story and how the OG Function's tests
// route around it). Wrangler's bundler still statically detects both
// literal specifiers below and bundles them (confirmed live) — a dynamic
// `import()` with a literal path is exactly as analyzable to esbuild as a
// static one.
//
// Init-once-per-isolate: Workers reuse a warm isolate across requests, so
// this (which throws if `initWasm` is called twice) is guarded by a
// module-scope promise — every request after the first isolate-cold one
// reuses the same already-resolved `ready`.
// ─────────────────────────────────────────────────────────────────────────

import { Resvg, initWasm } from '@resvg/resvg-wasm';

const FONT_FAMILY = 'Cormorant Garamond';

let ready = null;
function ensureReady() {
  if (!ready) {
    ready = Promise.all([
      import('../../node_modules/@resvg/resvg-wasm/index_bg.wasm').then((m) => initWasm(m.default)),
      import('./fonts/cormorant-garamond-italic-subset.bin').then((m) => new Uint8Array(m.default)),
    ]).then(([, fontBytes]) => fontBytes);
  }
  return ready;
}

/**
 * Rasterise an SVG string to PNG bytes.
 * @param {string} svg  A complete, self-contained SVG document (explicit
 *   pixel `width`/`height` on the root <svg> — resvg's `fitTo: {mode:
 *   'width', ...}` below locks the OUTPUT to that exact width, height
 *   following from the SVG's own aspect ratio).
 * @param {{width: number}} opts
 * @returns {Promise<Uint8Array>}
 */
export async function svgToPng(svg, { width }) {
  const fontBytes = await ensureReady();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontBuffers: [fontBytes],
      loadSystemFonts: false, // no OS font store exists in this runtime anyway
      serifFamily: FONT_FAMILY,
      defaultFontFamily: FONT_FAMILY,
    },
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  resvg.free();
  return png;
}

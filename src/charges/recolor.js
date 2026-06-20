import { useState, useEffect } from 'react';
import { recolorCharge, viewBoxOf } from './recolor-core.js';

export { recolorCharge, viewBoxOf } from './recolor-core.js';

// The vendored charge library (GPL/CC-BY-SA, ~2,200 SVGs) lives in R2 (Cloudflare
// object storage), CDN-cached, CORS-open — not bundled in the repo. `path` is the
// catalog path, e.g. "lion/lion-rampant".
export const R2_BASE = 'https://pub-b430701fd019477e916a2a94549058cf.r2.dev/charges';

const cache = new Map();
export function fetchCharge(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(`${R2_BASE}/${path}.svg`).then((r) => (r.ok ? r.text() : null)).catch(() => null));
  }
  return cache.get(path);
}

/** Resolve a charge's recoloured art (for export, before render). */
export async function resolveCharge(file, hex) {
  const svg = await fetchCharge(file);
  if (!svg) return null;
  return { viewBox: viewBoxOf(svg), inner: recolorCharge(svg, hex) };
}

/** React hook: fetch + recolour a charge; returns { viewBox, inner } when ready. */
export function useCharge(file, hex) {
  const [art, setArt] = useState(null);
  useEffect(() => {
    if (!file) { setArt(null); return undefined; }
    let live = true;
    fetchCharge(file).then((svg) => {
      if (live && svg) setArt({ viewBox: viewBoxOf(svg), inner: recolorCharge(svg, hex) });
    });
    return () => { live = false; };
  }, [file, hex]);
  return art;
}

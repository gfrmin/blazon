import { useState, useEffect } from 'react';
import { recolorCharge, viewBoxOf } from './recolor-core.js';

export { recolorCharge, viewBoxOf } from './recolor-core.js';

// Fetch + cache the raw charge SVG (same-origin /charges/, CDN-cached).
const cache = new Map();
export function fetchCharge(file) {
  if (!cache.has(file)) {
    cache.set(file, fetch(`/charges/${file}.svg`).then((r) => (r.ok ? r.text() : null)).catch(() => null));
  }
  return cache.get(file);
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

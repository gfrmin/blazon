import { useState, useEffect } from 'react';
import { recolorCharge, viewBoxOf } from './recolor-core.js';

export { recolorCharge, viewBoxOf } from './recolor-core.js';

// The vendored charge library (GPL/CC-BY-SA, ~2,200 SVGs) lives in R2 (Cloudflare
// object storage), CDN-cached, CORS-open — not bundled in the repo. `path` is the
// catalog path, e.g. "lion/lion-rampant".
export const R2_BASE = 'https://pub-b430701fd019477e916a2a94549058cf.r2.dev/charges';

// Composite identity for a tincture-resolved charge, used to key every
// artCache-shaped map in the codebase (Achievement.jsx's `artCache`,
// Shield.jsx's `chargeArt`, functions/_lib/achievementArt.js's prefetch
// cache). `file` alone is NOT a safe cache key: `resolveCharge` bakes `hex`
// into `art.inner` (the silhouette recolour below), so the SAME file drawn
// in two different tinctures — e.g. an Or lion on the shield and an Argent
// lion crest, both `lion/lion-rampant` — must occupy two different cache
// entries, not collide into one (the last write wins otherwise, and every
// slot sharing that file silently renders in whichever tincture wrote last).
// Fixed at review round 1 (task-17-report.md) after this exact collision
// made the OG image ignore per-slot tinctures for same-file/different-hex
// designs. One helper, imported on both the write side (the prefetch) and
// every read side (Achievement.jsx, Shield.jsx) so they can't drift apart.
export const artKey = (file, hex) => `${file}::${hex}`;

const cache = new Map();
export function fetchCharge(path) {
  if (!cache.has(path)) {
    const p = fetch(`${R2_BASE}/${path}.svg`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((svg) => {
        // Don't memoize a failure forever — a transient network error or a
        // cold-cache 5xx would otherwise pin this charge to "no art" for the
        // whole session. Evict so the next request retries.
        if (svg == null) cache.delete(path);
        return svg;
      });
    cache.set(path, p);
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
  // Drop stale art the instant the FILE changes (keyed on file alone, not hex),
  // so a swap never briefly shows the previous charge while the new one loads —
  // and if the new fetch fails, we don't keep the wrong charge on screen. A
  // hex-only change (a tincture swap of the same file) is intentionally NOT
  // cleared here, so it recolours in place without a blank flash.
  useEffect(() => { setArt(null); }, [file]);
  useEffect(() => {
    if (!file) { setArt(null); return undefined; }
    let live = true;
    fetchCharge(file).then((svg) => {
      if (!live) return;
      // Set the resolved art, or clear on failure (evict stale art) — never
      // leave whatever was showing before.
      setArt(svg ? { viewBox: viewBoxOf(svg), inner: recolorCharge(svg, hex) } : null);
    });
    return () => { live = false; };
  }, [file, hex]);
  return art;
}

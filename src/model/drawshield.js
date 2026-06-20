// ─────────────────────────────────────────────────────────────────────────
// DrawShield bridge — emit a blazon string the DrawShield renderer can parse.
//
// The spec names DrawShield as the v1 renderer (§7); it accepts a standard
// blazon string and returns SVG/PNG/JSON (its `blazonML` AST). Our formal
// serializer already produces standard blazon, so this is a thin adapter:
// anything our own SVG engine can't draw yet, we hand to DrawShield as text.
// As a custom renderer grows, callers move off this incrementally.
// ─────────────────────────────────────────────────────────────────────────

import { blazon } from './blazon.js';

const ENDPOINT = 'https://drawshield.net/api/drawshield';

/** A DrawShield-compatible blazon string for `d` (a Coat AST or the legacy object). */
export function toDrawShieldBlazon(d) {
  return blazon(d, 'formal');
}

/**
 * Build a DrawShield render URL (GET). `format`: 'svg' | 'png' | 'json'.
 * No network call here — callers fetch/embed the URL.
 */
export function drawShieldURL(d, { format = 'svg', size = 500 } = {}) {
  const params = new URLSearchParams({
    blazon: toDrawShieldBlazon(d),
    asfile: '1',
    palette: 'wappenwiki',
    format,
    size: String(size),
  });
  return `${ENDPOINT}?${params.toString()}`;
}

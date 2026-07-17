// ─────────────────────────────────────────────────────────────────────────
// DrawShield bridge — render anything our own SVG engine can't draw yet.
//
// The spec names DrawShield as the v1 renderer (§7). It accepts a standard
// blazon string and returns SVG/PNG (and its blazonML JSON). Our formal
// serializer already produces standard blazon, so this is a thin adapter.
//
// IMPORTANT — the public API is rate-limited ("a handful of requests per
// minute"); callers must DEBOUNCE and only render the settled design, never on
// every keystroke/swap. Independence path (self-host the GPL renderer/assets)
// is tracked separately; this stays the single place the URL is built so the
// whole app can be repointed at a self-hosted origin by changing ENDPOINT.
// ─────────────────────────────────────────────────────────────────────────

import { blazon } from './blazon.js';
import { stripAchievement } from './achievement.js';

// Public DrawShield API (GET). Repoint here when self-hosting.
const ENDPOINT = 'https://drawshield.net/include/drawshield.php';

/**
 * A DrawShield-compatible blazon string for `d` (a Coat AST or the legacy object).
 *
 * Achievement furniture is ALWAYS rendered locally (Achievement.jsx) and NEVER
 * sent to the real DrawShield API — `blazon(d,'formal')` appends achievement
 * clauses ("Crest: …", "Supporters: …") after the escutcheon sentence, which are
 * plain-English-labelled prose, not DrawShield blazon grammar. Strip the
 * achievement first so a design with an out-of-vocab escutcheon AND an
 * achievement still sends a SHIELD-ONLY blazon to the fallback API.
 */
export function toDrawShieldBlazon(d) {
  return blazon(stripAchievement(d), 'formal');
}

/**
 * Build a DrawShield render URL (GET). No network call here — callers fetch/embed it.
 * @param {object} d  A Coat AST or the legacy flat object.
 * @param {{format?:'svg'|'png'|'jpg', size?:number, palette?:string}} [opts]
 */
export function drawShieldURL(d, { format = 'svg', size = 500, palette = 'wappenwiki' } = {}) {
  const params = new URLSearchParams({
    blazon: toDrawShieldBlazon(d),
    outputformat: format,
    size: String(size),
    palette,
  });
  return `${ENDPOINT}?${params.toString()}`;
}

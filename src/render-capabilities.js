// ─────────────────────────────────────────────────────────────────────────
// Render capabilities — the SINGLE source of truth for what the LOCAL SVG
// engine (Shield.jsx) can actually draw, versus what defers to the DrawShield
// remote-fallback bridge.
//
// Extracted out of Shield.jsx (a .jsx file) into this plain .js module so it
// can be imported by BOTH Shield.jsx and functions/api/generate.js. A
// Cloudflare Pages Function is bundled by wrangler's own esbuild pass, scoped
// to functions/ with no JSX loader wired up for arbitrary src/ imports — so
// reaching into Shield.jsx (which also drags in `react`) to grab three
// constant arrays would be an avoidable build risk for a Pages Function that
// otherwise only imports plain model/.js modules. Keeping the capability
// tables here means the generation tool schema's enums can never drift from
// what the renderer actually draws — there is exactly one LOCAL_ORDINARIES,
// one LOCAL_DIVISIONS, one LOCAL_CHARGES, imported by both sides.
// ─────────────────────────────────────────────────────────────────────────

import { normalize } from './model/achievement.js';
import { hasArt } from './charges/manifest.js';

export const LOCAL_DIVISIONS = ['per pale', 'per fess', 'quarterly', 'per bend', 'per bend sinister', 'per saltire', 'per chevron'];
export const LOCAL_ORDINARIES = ['fess', 'pale', 'bend', 'cross', 'chevron', 'saltire'];
export const LOCAL_CHARGES = ['roundel', 'lozenge', 'crescent', 'mullet'];

/**
 * Can the local SVG engine draw this design faithfully? (Else the caller should
 * use the DrawShield bridge.) Conservative: lines of partition, field
 * treatments, subordinaries, marshalling, and any charge/ordinary outside the
 * LOCAL_* sets all defer to DrawShield.
 */
export function canRenderLocally(design) {
  const coat = normalize(design);
  if (!coat) return true;
  if (coat.marshalling) return false;
  const f = coat.field || {};
  if (f.treatment) return false;
  if (f.division) {
    if (!LOCAL_DIVISIONS.includes(f.division.type)) return false;
    if (f.division.line && f.division.line !== 'straight') return false;
  }
  for (const g of coat.charges || []) {
    const o = g.object || {};
    if (o.line && o.line !== 'straight') return false;
    if (o.kind === 'ordinary' && !LOCAL_ORDINARIES.includes(o.key)) return false;
    if (o.kind === 'subordinary') return false; // none drawn locally yet
    if (o.kind === 'charge') {
      // Shield.jsx's chargeSlots only lays out up to 3 charges; a higher count
      // would draw fewer figures than the blazon names, so defer to DrawShield
      // (which arranges any number faithfully).
      if ((g.number || 1) > 3) return false;
      if (!LOCAL_CHARGES.includes(o.key) && !hasArt(o.key, o.attitude)) return false;
    }
  }
  return true;
}

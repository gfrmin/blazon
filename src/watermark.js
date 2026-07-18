// ─────────────────────────────────────────────────────────────────────────
// Watermark — the caption line(s) written into the free-tier export footer.
// Pure string logic only (no DOM/canvas), split out of export.js so it's
// covered by a plain `node --test` unit test without pulling in Shield.jsx
// (JSX) or react-dom/server. export.js is the sole runtime consumer, drawing
// these strings into the SVG/canvas footer band.
// ─────────────────────────────────────────────────────────────────────────

import { blazon } from './heraldry.js';

// Task-6 brief §4, verbatim: the free PNG's credit line.
export const WATERMARK_TEXT = 'made with blazon.fyi';

/** The free-tier export footer text: the formal blazon (existing behaviour),
 *  plus the small "made with blazon.fyi" credit — a considered mark of its
 *  making, not a stamp. */
export function footerCaption(design) {
  return {
    blazon: blazon(design, 'formal'),
    watermark: WATERMARK_TEXT,
  };
}

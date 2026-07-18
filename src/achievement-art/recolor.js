// ─────────────────────────────────────────────────────────────────────────
// Achievement-furniture recolour — DIFFERENT convention from src/charges'
// silhouette recolour (which swaps every non-dark fill in a whole SVG).
//
// Task 8's report confirmed: DrawShield's mantling/torse art recolours by
// ELEMENT ID, not by placeholder fill — a small, fixed set of `<g id="…">`
// wrappers (`dexter1-1`/`sinister1-1`/… for mantling, `tincture1-1`/… for
// torse) carry the tincture, and everything OUTSIDE those groups (the
// mantling's large body, the torse's outline strokes) must stay untouched.
// Each id sits on a <g>, not directly on the fill-bearing <path>s inside it —
// so recolouring means: find that group's full (balanced-tag) subtree, then
// apply the existing silhouette swap (src/charges/recolor-core.js) to ONLY
// that subtree, leaving the rest of the document byte-for-byte identical.
// ─────────────────────────────────────────────────────────────────────────

import { recolorCharge } from '../charges/recolor-core.js';

/**
 * Locate a `<g id="…">…</g>` element's full span in `svg`, honouring nested
 * `<g>` children (a naive non-greedy regex would stop at the first `</g>`,
 * which is wrong whenever the tagged group itself contains child groups —
 * true for every recolour id in the vendored mantling/torse art).
 * @returns {{start:number, end:number, openEnd:number}|null}  `start`/`end` bound
 *  the whole `<g id="…">…</g>` (end is exclusive, just past `</g>`); `openEnd`
 *  is just past the opening tag (the start of the group's inner content).
 */
function findGroupSpan(svg, id) {
  const openRe = new RegExp(`<g[^>]*\\bid="${id}"[^>]*>`);
  const openMatch = openRe.exec(svg);
  if (!openMatch) return null;
  const start = openMatch.index;
  const openEnd = start + openMatch[0].length;

  const tagRe = /<g\b[^>]*?(\/)?>|<\/g>/g;
  tagRe.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = tagRe.exec(svg))) {
    if (m[0] === '</g>') {
      depth -= 1;
      if (depth === 0) return { start, end: m.index + m[0].length, openEnd };
    } else if (!m[1]) {
      depth += 1; // an opening (non-self-closing) nested <g>
    }
  }
  return null; // unbalanced/missing closing tag — leave the document untouched
}

/**
 * Recolour every fill inside the given id-tagged `<g>` groups to `hex`,
 * leaving the rest of `svg` untouched. Missing ids are silently skipped (so a
 * future asset swap that drops an id degrades to "no recolour there" rather
 * than throwing).
 * @param {string} svg
 * @param {string[]} ids
 * @param {string} hex
 */
function recolorGroups(svg, ids, hex) {
  let out = svg;
  for (const id of ids) {
    const span = findGroupSpan(out, id);
    if (!span) continue;
    const inner = out.slice(span.openEnd, span.end - 4); // trim the trailing </g>
    const recoloured = recolorCharge(`<svg>${inner}</svg>`, hex);
    out = out.slice(0, span.openEnd) + recoloured + out.slice(span.end - 4);
  }
  return out;
}

/**
 * Recolour a vendored furniture SVG (mantling or torse) by its manifest
 * `recolorIds` groups. Callers must resolve `colourHex`/`metalHex` themselves
 * from each achievement member's OWN tincture order — torse.tinctures is
 * `[metal, colour]` but mantling.tinctures is `[colour, metal]` (opposite
 * order; see achievement.js/task-9-report.md) — this function only ever takes
 * the resolved-by-name hexes, so that mapping bug can't leak in here.
 * @param {string} svg
 * @param {{colour:string[], metal:string[]}} recolorIds  from achievement-art/manifest.js
 * @param {{colourHex:string, metalHex:string}} hexes
 */
export function recolorFurniture(svg, recolorIds, { colourHex, metalHex }) {
  let out = recolorGroups(svg, recolorIds.colour || [], colourHex);
  out = recolorGroups(out, recolorIds.metal || [], metalHex);
  return out;
}

/**
 * Swap a small set of EXACT placeholder fill values to fixed hex colours —
 * NOT the silhouette-wide swap `recolorCharge` does (that would also swap the
 * genuine grey shading/highlight fills the vendored helmets use for steel
 * shading, destroying the detail). Task 8's report noted the 5 vendored
 * helmets carry no livery recolour ids (helm material is fixed, never
 * derived from the coat's own tinctures) but DID flag their placeholder-
 * yellow (`#ff0`) fill as "will look correct once real steel/gold/silver
 * tinctures are applied" — confirmed on inspection: every helmet uses `#ff0`
 * as its one swappable placeholder (the peer's cloth cap additionally uses
 * `red`), while `gray`/`#666`/`#999`/… are genuine fixed shading that must
 * survive untouched.
 * @param {string} svg
 * @param {Record<string,string>} mapping  exact placeholder value → replacement hex/keyword
 */
export function swapPlaceholderFills(svg, mapping) {
  let out = svg;
  for (const [from, to] of Object.entries(mapping)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`fill:${escaped}\\b`, 'g'), `fill:${to}`)
      .replace(new RegExp(`fill="${escaped}"`, 'g'), `fill="${to}"`);
  }
  return out;
}

/** Strip a vendored asset's outer `<svg ...>…</svg>` wrapper, for inlining its
 *  content into a caller-positioned nested `<svg>` — no recolour, just the
 *  same unwrap `recolorCharge` already does as its first step. */
export function innerMarkup(svg) {
  return svg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

export { findGroupSpan }; // exported for direct unit testing

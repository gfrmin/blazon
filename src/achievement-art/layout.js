// ─────────────────────────────────────────────────────────────────────────
// Achievement.jsx geometry — the SINGLE source of truth for every constant
// used to place a layer (LAYOUT), plus the pure anchor-math functions that
// derive each layer's box from it. No React here — Achievement.jsx imports
// this module and only handles JSX/markup; everything measurable lives here
// so it's independently unit-testable without rendering anything.
//
// Stacking order (bottom of the helm cluster → top), per Task 8's report and
// standard heraldic convention: the escutcheon sits under the helm; the helm's
// neck meets the shield's top edge; the TORSE (twisted wreath) sits across the
// helm's CROWN (top), not its neck; the CREST stands on the torse, above it.
// Task 8 flagged that the 5 vendored helmets have no shared "neck"/"crown"
// anchor point (aspect ratios vary a lot by artist/orientation) — so both the
// shield-to-helm offset and the helm-to-torse ("crown") offset are per-style
// tunables here (`LAYOUT.helm.crown[style]`), not a single shared constant.
// ─────────────────────────────────────────────────────────────────────────

import { tinctureHex } from '../model/tinctures.js';

// Native aspect ratios (width/height) baked into the vendored art's own
// viewBox — used to size each layer without distorting it.
export const SHIELD_ASPECT = 200 / 240; // src/Shield.jsx SHIELD_PATH viewBox
export const MANTLING_ASPECT = 1000 / 1200; // achievement-art/mantling/cloak.svg — same 5:6 as the shield, at 5×
export const TORSE_ASPECT = 204.998 / 42.041; // achievement-art/torse/torse.svg
export const MOTTO_ASPECT = 956 / 197; // achievement-art/motto/scroll-*.svg
export const COMPARTMENT_ASPECT = 889.222 / 60.056; // achievement-art/compartments/pedestal.svg

export const LAYOUT = {
  viewBox: { w: 1000, h: 1200 },

  // The escutcheon — the hero. Everything else is sized/positioned relative
  // to this box. Deliberately well short of the canvas width (48%) — the
  // rest of the composition (helm cluster above, supporters beside,
  // motto/compartment below) all needs room too; the shield still dominates
  // because it's by far the single largest element, not because it fills
  // the frame edge-to-edge.
  shield: { x: 260, y: 330, w: 480 },

  // Mantling: Task 8 confirmed the art's own 1000×1200 viewBox is EXACTLY 5×
  // the shield's 200×240 one — i.e. it's designed to be scaled to the shield's
  // own bounding box and sit directly behind it (its corner flourishes then
  // poke out past the shield's upper edges; the unlabelled white body is fully
  // hidden behind the escutcheon). Kept as its own box (not derived) so it can
  // be nudged independently if the visual QA calls for it.
  mantling: { x: 260, y: 330, w: 480 },

  helm: {
    height: 170, // px, before per-style aspect scaling (width = height × the SVG's own aspect)
    shieldOverlap: 25, // the helm's neck sinks this far below the shield's top edge (drawn first, so the shield's edge crisply cuts across it)
    // Fraction of the helm's OWN rendered height, down from its top edge, at
    // which its crown sits (where the torse centres). No two vendored helmets
    // share an anchor point (Task 8) — tuned per style by eye against the
    // contact sheet; `default` covers any future style not listed here.
    crown: { default: 0.12, royal: 0.12, peer: 0.10, baronet: 0.13, knight: 0.11, esquire: 0.14 },
  },

  // Torse width scales off the CHOSEN helm's own rendered width (helms vary a
  // lot in aspect — Task 8 — so a fixed width would sit right for one style
  // and comically wide/narrow for another); height derived from TORSE_ASPECT.
  torse: { widthFactor: 1.35 },

  crest: {
    width: 150,
    height: 150,
    // How far the crest's bottom edge sinks into the torse (fraction of the
    // torse's own height) — a small overlap reads as "standing on" it.
    torseOverlap: 0.3,
  },

  // Box aspect is a compromise: vendored charge art varies hugely in its own
  // native aspect (lion-rampant ~0.95, dragon ~1.26, a running wolf ~2.4) —
  // no single box makes every possible supporter charge fill it edge to
  // edge (`preserveAspectRatio="meet"` always letterboxes to the tighter
  // dimension). A moderately tall-ish box (not the very narrow one first
  // tried) reads well for the common "beast rampant" supporter case.
  supporters: {
    width: 240,
    height: 420,
    gap: 10, // horizontal gap between the shield's edge and the supporter's inner edge
    footDrop: 35, // how far below the shield's base a supporter's feet sit
  },

  // Motto scroll and compartment both anchor to the bottom of the composition,
  // below the shield/supporters. The compartment (when present) sits highest
  // of the two, immediately under the supporters' feet; the motto then sits
  // below the compartment, or directly below the shield/supporters when there
  // is no compartment.
  motto: { width: 620, gapAboveNoCompartment: 60, gapAboveCompartment: 20 },
  compartment: { width: 620, gapAboveShield: 10 },
};

// Fixed helm-material palette (never livery-derived — see recolor.js's
// `swapPlaceholderFills`). Matches each rank's own HELMETS `plain` gloss
// (achievement.js): steel for esquire/knight, steel-and-gilt for baronet,
// silver-with-red-cap-and-gilt for peer, gold for royal.
const STEEL = '#9AA3AD';
const GOLD = '#D4AF52'; // == TINCTURES.Or.hex — a deliberate, consistent "gilt" tone
const CAP_RED = '#8B2E2E';

export const HELM_MATERIAL = {
  esquire: { '#ff0': STEEL },
  knight: { '#ff0': STEEL },
  baronet: { '#ff0': GOLD },
  peer: { '#ff0': GOLD, red: CAP_RED },
  royal: { '#ff0': GOLD },
};

// Same fixed-placeholder-swap treatment for the compartment (Task 8: "not
// livery-tinctured… reads as a stone/gilt ledge either way") — its one `#ff0`
// placeholder reads as a harsh flat yellow left as-is; swapped to the same
// gilt tone as the helm accents for a coherent "stone/gilt ledge" look.
export const COMPARTMENT_MATERIAL = { '#ff0': GOLD };

/** Parse an SVG `viewBox` attribute string ("0 0 270.013 316.914") → width/height aspect (w/h). */
export function aspectFromViewBox(viewBox) {
  const parts = String(viewBox).trim().split(/\s+/).map(Number);
  const [, , w, h] = parts;
  return w && h ? w / h : 1;
}

// ── Pure anchor-math ────────────────────────────────────────────────────────

export function shieldBox(L = LAYOUT) {
  const { x, y, w } = L.shield;
  return { x, y, w, h: w / SHIELD_ASPECT };
}

export function mantlingBox(L = LAYOUT) {
  const { x, y, w } = L.mantling;
  return { x, y, w, h: w / MANTLING_ASPECT };
}

export function helmBox(style, aspect, L = LAYOUT) {
  const sb = shieldBox(L);
  const h = L.helm.height;
  const w = h * aspect;
  const cx = sb.x + sb.w / 2;
  const bottom = sb.y + L.helm.shieldOverlap;
  return { x: cx - w / 2, y: bottom - h, w, h, cx };
}

export function torseBox(style, aspect, L = LAYOUT) {
  const hb = helmBox(style, aspect, L);
  const crownFraction = L.helm.crown[style] ?? L.helm.crown.default;
  const centerY = hb.y + hb.h * crownFraction;
  const w = hb.w * L.torse.widthFactor; // scales with THIS helm's own rendered width, not a fixed constant
  const h = w / TORSE_ASPECT;
  return { x: hb.cx - w / 2, y: centerY - h / 2, w, h, centerY, cx: hb.cx };
}

export function crestBox(style, aspect, L = LAYOUT) {
  const tb = torseBox(style, aspect, L);
  const { width: w, height: h, torseOverlap } = L.crest;
  const bottom = tb.centerY + tb.h * torseOverlap;
  return { x: tb.cx - w / 2, y: bottom - h, w, h };
}

/** @param {'dexter'|'sinister'} side */
export function supporterBox(side, L = LAYOUT) {
  const sb = shieldBox(L);
  const { width: w, height: h, gap, footDrop } = L.supporters;
  const y = sb.y + sb.h - h + footDrop;
  const x = side === 'dexter' ? sb.x - gap - w : sb.x + sb.w + gap;
  return { x, y, w, h, mirror: side === 'sinister' };
}

export function compartmentBox(L = LAYOUT) {
  const sb = shieldBox(L);
  const { width: w, gapAboveShield } = L.compartment;
  const h = w / COMPARTMENT_ASPECT;
  const x = (L.viewBox.w - w) / 2;
  const y = sb.y + sb.h + gapAboveShield;
  return { x, y, w, h };
}

export function mottoBox(hasCompartment, L = LAYOUT) {
  const sb = shieldBox(L);
  const { width: w, gapAboveNoCompartment, gapAboveCompartment } = L.motto;
  const h = w / MOTTO_ASPECT;
  const x = (L.viewBox.w - w) / 2;
  const y = hasCompartment
    ? (() => { const cb = compartmentBox(L); return cb.y + cb.h + gapAboveCompartment; })()
    : sb.y + sb.h + gapAboveNoCompartment;
  return { x, y, w, h };
}

// ── Livery → fill mapping ────────────────────────────────────────────────
// torse.tinctures is [metal, colour]; mantling.tinctures is [colour, metal] —
// OPPOSITE order (Task 9 review finding). These two functions are the ONLY
// place that indexes into either array, each keyed by NAME (not a shared
// index→id-group function), so the opposite-order gotcha can't leak past here.

/** @param {{tinctures:string[]}} torse  tinctures = [metal, colour] */
export function torseLiveryHex(torse) {
  const [metal, colour] = torse.tinctures;
  return { colourHex: tinctureHex(colour), metalHex: tinctureHex(metal) };
}

/** @param {{tinctures:string[]}} mantling  tinctures = [colour, metal] */
export function mantlingLiveryHex(mantling) {
  const [colour, metal] = mantling.tinctures;
  return { colourHex: tinctureHex(colour), metalHex: tinctureHex(metal) };
}

// ── Motto fitting ────────────────────────────────────────────────────────
// validate.js already warns (non-blocking) past 30 chars. The renderer's own
// backstop: textLength+lengthAdjust (applied in Achievement.jsx) always
// compresses the glyphs to fit the scroll's width, however long the text —
// but compressing an absurdly long string into a fixed-width path makes it
// illegible, so a hard cap truncates with an ellipsis well past the point
// textLength compression could still read.
export const MOTTO_SOFT_MAX = 30; // matches validate.js's warning threshold
const MOTTO_HARD_MAX = 60;

/** Clamp `text` for rendering on the motto scroll: never returns more than
 *  MOTTO_HARD_MAX characters (ellipsised if it had to cut). */
export function fitMotto(text, hardMax = MOTTO_HARD_MAX) {
  const t = (text || '').trim();
  if (t.length <= hardMax) return t;
  return `${t.slice(0, hardMax - 1).trimEnd()}…`;
}

// SVG `textLength` for the motto, in the scroll's own 956-unit viewBox space.
// Scales with the actual character count (so a short motto isn't stretched
// wide) but is clamped to the scroll's usable span — the actual mechanism
// that makes "≤30 chars always fits; longer text must not overflow" true
// regardless of how long `fitMotto` lets a string get.
const MOTTO_AVG_CHAR_WIDTH = 22; // px, calibrated for the rendered font-size (40, in the 956×197 viewBox)
const MOTTO_MAX_TEXT_LENGTH = 820; // the scroll's usable horizontal span (Task 8: ~880-unit chord, small margin)

export function mottoTextLength(text, avgCharWidth = MOTTO_AVG_CHAR_WIDTH, max = MOTTO_MAX_TEXT_LENGTH) {
  const len = (text || '').length;
  return Math.min(len * avgCharWidth, max) || 1; // textLength="0" is invalid SVG
}

// An INDEPENDENT quadratic-bezier guide path for the motto text to follow —
// built from Task 8's report (start/apex/end points recorded for
// motto/scroll-below.svg, in the scroll's own 956×197 viewBox: start (38,98),
// apex (478,189), end (918,95), bowing downward) — rather than referencing
// the vendored asset's own internal guide path, which sits inside a
// `transform="matrix(…)"` ancestor group. `<textPath>`'s handling of a
// referenced path that carries its own ancestor transform is inconsistent
// across SVG renderers (notably the resvg engine Task 17's SSR/OG-image
// pipeline is expected to use) — a plain, untransformed path sidesteps that
// entirely. Passing through the recorded apex (478,189) at the curve's exact
// midpoint requires the quadratic control point pulled further than the
// visual apex — the standard quadratic-bezier midpoint identity:
// control = 2×apex − (start+end)/2.
export const MOTTO_GUIDE_PATH = 'M38,98 Q478,281.5 918,95';

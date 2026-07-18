// Pure charge-recolour helpers (no React) so they're unit-testable.
//
// DrawShield charge SVGs are inconsistent about which placeholder is the "body",
// so instead of swapping one colour we treat a charge as a SILHOUETTE: every
// fill that isn't a near-black outline becomes the tincture, `none` is preserved,
// and no-fill paths inherit the tincture from the wrapping <svg fill=…>.
const KEEP_LUM = 0.12; // fills darker than this are kept as outlines/detail

export function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // A malformed length (a 4-/5-digit fragment) parses to NaN — treat it as light
  // (so it recolours as body) rather than letting NaN poison the comparison.
  if (Number.isNaN(r + g + b)) return 1;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const keep = (val) => val.toLowerCase() === 'none' || luminance(val) < KEEP_LUM;

// DrawShield SVGs also use NAMED placeholder colours (most commonly `fill:red`)
// for the body — these slipped past the hex-only swap and rendered raw (a fully
// red anchor, red artefacts on the lion/rose…). Swap the bright placeholder names
// to the tincture; keep `none`, `black`, and non-colour keywords (url(), inherit,
// currentColor, transparent) untouched so gradients/outlines survive.
const NAMED_BODY = new Set([
  'red', 'blue', 'green', 'lime', 'yellow', 'cyan', 'magenta', 'aqua', 'fuchsia',
  'orange', 'purple', 'maroon', 'navy', 'teal', 'olive', 'silver', 'gray', 'grey',
  'white', 'gold', 'pink', 'brown',
]);
const swapNamed = (name) => NAMED_BODY.has(name.toLowerCase());

// A hex colour of exactly 3, 6, or 8 digits — longest-first alternation with a
// trailing non-hex lookahead so an #RRGGBBAA is matched whole (never as a
// 6-digit prefix + stray "AA"), and 4-/5-digit fragments never match at all.
const HEX = '#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])';

/** Inner markup of a charge SVG with body fills swapped to `hex` (outlines kept). */
export function recolorCharge(svg, hex) {
  const inner = svg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const swapHex = (m, val) => {
    if (keep(val)) return m;
    // Preserve an 8-digit #RRGGBBAA alpha channel — recolour only the RGB, so a
    // partly-transparent body fill keeps its transparency instead of becoming a
    // solid (or, if the alpha were dropped, a near-transparent) fill.
    const replacement = val.length === 9 ? hex + val.slice(7) : hex;
    return m.replace(val, replacement);
  };
  const swapWord = (m, val) => (swapNamed(val) ? m.replace(val, hex) : m);
  return inner
    .replace(new RegExp(`fill:\\s*(${HEX}|none)`, 'g'), swapHex)
    .replace(new RegExp(`fill="(${HEX}|none)"`, 'g'), swapHex)
    .replace(/fill:\s*([a-zA-Z]+)/g, swapWord)
    .replace(/fill="([a-zA-Z]+)"/g, swapWord);
}

export function viewBoxOf(svg) {
  return svg.match(/viewBox="([^"]*)"/i)?.[1] || '0 0 100 100';
}

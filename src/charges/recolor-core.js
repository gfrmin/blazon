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

/** Inner markup of a charge SVG with body fills swapped to `hex` (outlines kept). */
export function recolorCharge(svg, hex) {
  const inner = svg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const swapHex = (m, val) => (keep(val) ? m : m.replace(val, hex));
  const swapWord = (m, val) => (swapNamed(val) ? m.replace(val, hex) : m);
  return inner
    .replace(/fill:\s*(#[0-9a-fA-F]{3,6}|none)/g, swapHex)
    .replace(/fill="(#[0-9a-fA-F]{3,6}|none)"/g, swapHex)
    .replace(/fill:\s*([a-zA-Z]+)/g, swapWord)
    .replace(/fill="([a-zA-Z]+)"/g, swapWord);
}

export function viewBoxOf(svg) {
  return svg.match(/viewBox="([^"]*)"/i)?.[1] || '0 0 100 100';
}

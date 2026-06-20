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

/** Inner markup of a charge SVG with body fills swapped to `hex` (outlines kept). */
export function recolorCharge(svg, hex) {
  const inner = svg.replace(/<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const swap = (m, val) => (keep(val) ? m : m.replace(val, hex));
  return inner
    .replace(/fill:\s*(#[0-9a-fA-F]{3,6}|none)/g, swap)
    .replace(/fill="(#[0-9a-fA-F]{3,6}|none)"/g, swap);
}

export function viewBoxOf(svg) {
  return svg.match(/viewBox="([^"]*)"/i)?.[1] || '0 0 100 100';
}

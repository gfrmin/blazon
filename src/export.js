// ─────────────────────────────────────────────────────────────────────────
// Export — download the arms as a free PNG, with a blazon + "made with
// blazon.app" footer as the watermark (task-6 brief §4). One module; it
// reuses the same Shield renderer the screen uses (no second drawing path)
// and the DrawShield bridge for anything the local engine can't draw
// faithfully. SVG export is parked for the paid tier (a later task); the
// SVG-building function stays for that path (and OG-image work) to reuse.
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Shield, { canRenderLocally } from './Shield.jsx';
import { blazon, drawShieldURL, normalize, chargeGroup, tinctureHex } from './heraldry.js';
import { hasArt, artFile } from './charges/manifest.js';
import { resolveCharge } from './charges/recolor.js';
import { footerCaption } from './watermark.js';

const XMLNS = 'http://www.w3.org/2000/svg';
const FOOTER_H = 52; // band below the 240-tall shield for the blazon + watermark (+ credit)

const escapeXML = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Exported — Studio's Save-as name prompt (M3/B5, task-16 brief §2) reuses
// this exact slug logic for its default name, rather than hand-rolling a
// second one.
export function slug(design) {
  const s = blazon(design, 'formal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || 'coat-of-arms').slice(0, 60);
}

// Pre-resolve vendored charge art (the render hook can't run under
// renderToStaticMarkup), keyed by file so Shield renders it synchronously.
async function resolveDesignCharges(design) {
  const coat = normalize(design);
  const g = coat && chargeGroup(coat);
  if (!g || !g.object || !hasArt(g.object.key)) return null;
  const file = artFile(g.object.key, g.object.attitude);
  const art = await resolveCharge(file, tinctureHex(g.tincture));
  return art ? { [file]: art } : null;
}

// A self-contained, watermarked SVG string for a locally-renderable design.
// Renders the live Shield component to static markup (same output as on screen),
// extends the viewBox by a footer band, and writes the formal blazon into it.
async function localSVG(design, width = 600) {
  const chargeArt = await resolveDesignCharges(design);
  const markup = renderToStaticMarkup(React.createElement(Shield, { design, width, chargeArt }));
  const { blazon: blazonLine, watermark } = footerCaption(design);
  // textLength + lengthAdjust force the blazon to fit the width however long it is.
  const caption = `<text x="100" y="${240 + 15}" text-anchor="middle" textLength="184" lengthAdjust="spacingAndGlyphs" font-family="Cormorant Garamond, Georgia, serif" font-size="11" font-style="italic" fill="#C9A24B">${escapeXML(blazonLine)}</text>`;
  // The free-tier credit line — a considered mark of its making, not a stamp
  // (task-6 brief §4): same serif italic as the blazon line, smaller & dimmer.
  const mark = `<text x="100" y="${240 + 27}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="9" font-style="italic" fill="#C9A24B" fill-opacity="0.62">${escapeXML(watermark)}</text>`;
  // CC-BY-SA requires crediting the artwork when a vendored charge is present.
  const credit = chargeArt
    ? `<text x="100" y="${240 + 40}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="6.5" fill="#8a8674">Artwork: drawshield.net &amp; Wikimedia Commons · CC BY-SA</text>`
    : '';
  return markup
    .replace('<svg ', `<svg xmlns="${XMLNS}" `) // React omits the namespace
    .replace('viewBox="0 0 200 240"', `viewBox="0 0 200 ${240 + FOOTER_H}"`)
    .replace('</svg>', `${caption}${mark}${credit}</svg>`);
}

const svgDoc = (svg) => `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;

function triggerDownload(href, filename, revoke = false) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000);
}

function downloadBlob(blob, filename) {
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

// Rasterise an SVG string to a PNG Blob at `widthPx` — 1000px today, the
// free/screen-resolution tier served to everyone. The print-resolution
// (~300dpi) split for the paid tier lands in M4.
function svgToPNG(svgString, widthPx = 1000) {
  return new Promise((resolve, reject) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc(svgString))}`;
    const img = new Image();
    img.onload = () => {
      const w = widthPx;
      const h = Math.round((widthPx * (240 + FOOTER_H)) / 200);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG image load failed'));
    img.src = url;
  });
}

// The free-tier SVG download is parked (task-6 brief §4): SVG becomes part of
// the paid bundle in a later task. `localSVG()` above stays — the paid path
// and OG-image work reuse it — but there is no free-tier caller for it now.

/** Download the design as a free, watermarked, screen-resolution PNG. Remote
 *  (DrawShield-fallback) designs hand off to DrawShield's own PNG directly —
 *  post-processing that cross-origin image to add the watermark isn't
 *  possible; that gap persists until the renderer-migration milestone. */
export async function downloadPNG(design) {
  if (!design) return;
  if (canRenderLocally(design)) {
    downloadBlob(await svgToPNG(await localSVG(design), 1000), `${slug(design)}.png`);
  } else {
    triggerDownload(drawShieldURL(design, { format: 'png', size: 1000 }), `${slug(design)}.png`);
  }
}

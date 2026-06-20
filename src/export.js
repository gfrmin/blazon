// ─────────────────────────────────────────────────────────────────────────
// Export — download the arms as SVG or PNG, with a small blazon-text footer as
// the (free-tier) watermark per spec §2. One module; it reuses the same Shield
// renderer the screen uses (no second drawing path) and the DrawShield bridge
// for anything the local engine can't draw faithfully.
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Shield, { canRenderLocally } from './Shield.jsx';
import { blazon, drawShieldURL, normalize, chargeGroup, tinctureHex } from './heraldry.js';
import { hasArt, artFile } from './charges/manifest.js';
import { resolveCharge } from './charges/recolor.js';

const XMLNS = 'http://www.w3.org/2000/svg';
const FOOTER_H = 40; // band below the 240-tall shield for the blazon + credit

const escapeXML = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function slug(design) {
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
  // textLength + lengthAdjust force the blazon to fit the width however long it is.
  const caption = `<text x="100" y="${240 + 17}" text-anchor="middle" textLength="184" lengthAdjust="spacingAndGlyphs" font-family="Cormorant Garamond, Georgia, serif" font-size="11" font-style="italic" fill="#C9A24B">${escapeXML(blazon(design, 'formal'))}</text>`;
  // CC-BY-SA requires crediting the artwork when a vendored charge is present.
  const credit = chargeArt
    ? `<text x="100" y="${240 + 31}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="6.5" fill="#8a8674">Artwork: drawshield.net &amp; Wikimedia Commons · CC BY-SA</text>`
    : '';
  return markup
    .replace('<svg ', `<svg xmlns="${XMLNS}" `) // React omits the namespace
    .replace('viewBox="0 0 200 240"', `viewBox="0 0 200 ${240 + FOOTER_H}"`)
    .replace('</svg>', `${caption}${credit}</svg>`);
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

// Rasterise an SVG string to a PNG Blob at `widthPx` (≈300dpi for a ~3in shield).
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

/** Download the design as an SVG file. */
export async function downloadSVG(design) {
  if (!design) return;
  if (canRenderLocally(design)) {
    downloadBlob(new Blob([svgDoc(await localSVG(design))], { type: 'image/svg+xml' }), `${slug(design)}.svg`);
  } else {
    // Can't post-process DrawShield's SVG (cross-origin) — hand off its file directly.
    triggerDownload(drawShieldURL(design, { format: 'svg', size: 800 }), `${slug(design)}.svg`);
  }
}

/** Download the design as a print-resolution PNG. */
export async function downloadPNG(design) {
  if (!design) return;
  if (canRenderLocally(design)) {
    downloadBlob(await svgToPNG(await localSVG(design), 1000), `${slug(design)}.png`);
  } else {
    triggerDownload(drawShieldURL(design, { format: 'png', size: 1000 }), `${slug(design)}.png`);
  }
}

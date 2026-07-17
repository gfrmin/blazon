// ─────────────────────────────────────────────────────────────────────────
// Export — download the arms as a free, watermarked PNG, or (once unlocked,
// M4/B7) the clean paid files: SVG, a 300dpi PNG, and a PDF. One module; it
// renders the SAME `<Achievement>` composition the on-screen preview uses
// (WYSIWYG — see task-19-brief §1, the MERGE-BLOCKER this closes: this file
// used to render a bare `<Shield>` while the preview showed a full
// achievement) and the SSR seam (Task 12/17) both the og:image Function and
// this file share via `resolveAchievementArt` (src/achievementArt.js).
//
// `ssr: true` (Achievement.jsx) forces the local <Shield> unconditionally —
// same tradeoff the og:image Function already made and ships in prod: an
// out-of-vocab escutcheon degrades to whatever the local renderer can draw
// rather than the drawshield.net <foreignObject>/<img> fallback, which does
// not survive `renderToStaticMarkup` (no browser, no network turn to load
// the cross-origin image). This is narrower than the preview's own fallback
// (Studio's `shieldSlot` embeds the REAL DrawShield PNG for a non-local
// escutcheon) — a rare edge case (the generation vocabulary is deliberately
// almost-entirely local-renderable, Task 13), ledgered in task-19-report.md
// rather than solved here (would need a client-side pre-fetch-as-data-URI of
// the DrawShield PNG before render, mirroring Studio's `shieldSlot`).
// `backfill: false` (Task 14 review requirement, reused from Task 17):
// render EXACTLY the stored design, never silently re-seeding a part the
// user set aside.
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Achievement from './Achievement.jsx';
import { blazon, normalize } from './heraldry.js';
import { resolveAchievementArt } from './achievementArt.js';
import { footerCaption } from './watermark.js';

const XMLNS = 'http://www.w3.org/2000/svg';

// Achievement.jsx's own fixed canvas (src/achievement-art/layout.js
// LAYOUT.viewBox) — SAME 5:6 aspect as the pre-Task-19 bare-shield export's
// 200×240 viewBox (200:240 reduces to 5:6, same as 1000:1200), just 5× the
// linear scale. Every footer constant below is the old bare-shield export's
// own constant × 5 — same visual proportions, new canvas.
const ACH_W = 1000;
const ACH_H = 1200;
const FREE_FOOTER_H = 260; // 5 × the old 52px shield-footer band

const CC_BY_SA_NOTICE =
  'Artwork: DrawShield (drawshield.net) & Wikimedia Commons contributors, used under CC BY-SA 4.0. ' +
  'Full per-charge attribution: https://github.com/gfrmin/blazon/blob/master/ATTRIBUTION.md';

const escapeXML = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Insert `insertion` immediately before the DOCUMENT's own closing `</svg>`
// — i.e. the LAST one in the string, not the first. The achievement markup
// nests several of its own `<svg>` sub-elements (mantling/shield/helm/torse/
// motto each wrap themselves in one), so a plain `.replace('</svg>', …)`
// (which only ever touches the FIRST match) lands the insertion as a child
// of the mantling's own nested svg instead of the document root — nested
// `<svg>` establishes its own viewport and clips content outside it by
// default, so the caption/watermark/credit text rendered with correct
// content/fill/geometry (confirmed live: getBoundingClientRect, computed
// styles, all correct) yet painted NOTHING, because it sat outside the
// mantling's own small local viewport (task-19 live-verification finding —
// caught only by actually rasterising and sampling pixels, not by string-
// matching the markup, which is why export.test.js's assertions alone
// didn't catch it). `lastIndexOf` targets the true root close unambiguously.
function appendBeforeRootClose(svg, insertion) {
  const idx = svg.lastIndexOf('</svg>');
  return svg.slice(0, idx) + insertion + svg.slice(idx);
}

// Exported — Studio's Save-as name prompt (M3/B5, task-16 brief §2) reuses
// this exact slug logic for its default name, rather than hand-rolling a
// second one.
export function slug(design) {
  const s = blazon(design, 'formal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || 'coat-of-arms').slice(0, 60);
}

/**
 * The full achievement (mantling/shield/helm/torse/crest/supporters/motto),
 * exactly as the preview shows it, as a self-contained SVG string.
 *  - `clean: false` (default, free tier) — extends the canvas with a footer
 *    band carrying the formal blazon, the "made with blazon.app" watermark,
 *    and a small CC BY-SA credit line (the SAME considered mark, task-6
 *    brief §4, now sized for the achievement canvas instead of a bare shield).
 *  - `clean: true` (paid tier, task-19 brief §5) — NO visible caption; the
 *    CC BY-SA attribution (a licence obligation on the vendored charge/
 *    furniture art — never paid away) moves into an in-file `<metadata>`
 *    element instead: a valid manner of attribution that doesn't mark up the
 *    image itself.
 * Exported for tests (asserts the pre-rasterise markup directly, same
 * pattern as functions/api/og/[payload].js's `renderAchievementSVG`).
 * @param {object} design
 * @param {{clean?: boolean}} [opts]
 * @returns {Promise<string>}
 */
export async function achievementSVG(design, { clean = false } = {}) {
  const coat = normalize(design);
  const artCache = await resolveAchievementArt(coat);
  const markup = renderToStaticMarkup(
    React.createElement(Achievement, { design: coat, ssr: true, backfill: false, artCache }),
  );
  // React omits the SVG namespace. Achievement.jsx's root <svg> also renders
  // `width="100%"` with NO height attribute at all — correct for the on-screen
  // DOM (a definite containing block), but a PERCENTAGE width has nothing to
  // resolve against for svgToPNG's standalone `<img src="data:...">`
  // rasterisation below: browsers fall back to an arbitrary default object
  // size there, and preserveAspectRatio then letterboxes the WHOLE
  // composition into it — confirmed live (task-19 verification): the
  // free-tier footer band rasterised fully blank/mispositioned even though
  // the caption/watermark text was correctly present in this markup. Pin
  // BOTH width and height to definite pixel values (the achievement's own
  // native canvas) so rasterisation is unambiguous, mirroring the
  // pre-task-19 bare-shield export (which always passed <Shield
  // width={aNumber}> for the exact same reason).
  const withNS = markup
    .replace('<svg ', `<svg xmlns="${XMLNS}" `)
    .replace('width="100%"', `width="${ACH_W}" height="${ACH_H}"`);

  if (clean) {
    const metadata = `<metadata>${escapeXML(CC_BY_SA_NOTICE)}</metadata>`;
    return appendBeforeRootClose(withNS, metadata);
  }

  const { blazon: blazonLine, watermark } = footerCaption(coat);
  // textLength + lengthAdjust force the blazon to fit the width however long it is.
  const caption = `<text x="500" y="${ACH_H + 75}" text-anchor="middle" textLength="920" lengthAdjust="spacingAndGlyphs" font-family="Cormorant Garamond, Georgia, serif" font-size="55" font-style="italic" fill="#C9A24B">${escapeXML(blazonLine)}</text>`;
  const mark = `<text x="500" y="${ACH_H + 135}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="45" font-style="italic" fill="#C9A24B" fill-opacity="0.62">${escapeXML(watermark)}</text>`;
  // The achievement ALWAYS carries vendored CC-BY-SA art (helm/torse/
  // mantling/motto-scroll furniture at minimum, plus the crest/supporters'
  // default figural charges) — unlike the pre-Task-19 bare-shield export,
  // this credit line is unconditional, not gated on a shield charge existing.
  const credit = `<text x="500" y="${ACH_H + 200}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="32.5" fill="#8a8674">Artwork: drawshield.net &amp; Wikimedia Commons · CC BY-SA</text>`;
  const extended = withNS
    .replace(`viewBox="0 0 ${ACH_W} ${ACH_H}"`, `viewBox="0 0 ${ACH_W} ${ACH_H + FREE_FOOTER_H}"`)
    .replace(`height="${ACH_H}"`, `height="${ACH_H + FREE_FOOTER_H}"`);
  return appendBeforeRootClose(extended, `${caption}${mark}${credit}`);
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

// Rasterise an SVG string to a PNG Blob at `widthPx`×`heightPx`.
function svgToPNG(svgString, widthPx, heightPx) {
  return new Promise((resolve, reject) => {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoc(svgString))}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      canvas.getContext('2d').drawImage(img, 0, 0, widthPx, heightPx);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG image load failed'));
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('blob read failed'));
    reader.readAsDataURL(blob);
  });
}

/** Download the design as a free, watermarked, screen-resolution PNG — the
 *  full achievement, matching the on-screen preview exactly (WYSIWYG). */
export async function downloadPNG(design) {
  if (!design) return;
  const svg = await achievementSVG(design, { clean: false });
  const widthPx = 1000; // 1:1 with the achievement's own 1000-wide viewBox
  const heightPx = Math.round((widthPx * (ACH_H + FREE_FOOTER_H)) / ACH_W);
  downloadBlob(await svgToPNG(svg, widthPx, heightPx), `${slug(design)}.png`);
}

// ── Paid "clean" tier (M4/B7) — no watermark, CC-BY-SA moved into
// <metadata>. Client-side gating is the accepted MVP tradeoff (task-19 brief
// §5, documented): callers (DownloadDialog) only reach these once
// `isUnlocked(currentHash)` (src/unlock.js) is true. The HMAC unlock token
// minted by /api/verify-payment is forward-compatible with a future
// server-side /api/export that validates it — that seam is left clean, not
// built here. ──

/** The clean vector SVG — no caption, CC-BY-SA in <metadata>. */
export async function downloadCleanSVG(design) {
  if (!design) return;
  const svg = await achievementSVG(design, { clean: true });
  downloadBlob(new Blob([svgDoc(svg)], { type: 'image/svg+xml' }), `${slug(design)}.svg`);
}

// 300dpi print resolution: 2000px wide (task-19 brief §5, verbatim).
const PRINT_WIDTH = 2000;
const PRINT_HEIGHT = Math.round((PRINT_WIDTH * ACH_H) / ACH_W);

/** The clean, 300dpi (2000px-wide) print PNG — no caption. */
export async function downloadCleanPNG(design) {
  if (!design) return;
  const svg = await achievementSVG(design, { clean: true });
  downloadBlob(await svgToPNG(svg, PRINT_WIDTH, PRINT_HEIGHT), `${slug(design)}-print.png`);
}

/** The clean print PNG wrapped in a single-image PDF (lazy-loaded jsPDF —
 *  code-split, paid-bundle only, never in the entry chunk: see package.json,
 *  jsPDF is the one dependency task-19's brief permits, for exactly this). */
export async function downloadCleanPDF(design) {
  if (!design) return;
  const svg = await achievementSVG(design, { clean: true });
  const pngBlob = await svgToPNG(svg, PRINT_WIDTH, PRINT_HEIGHT);
  const dataUrl = await blobToDataURL(pngBlob);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PRINT_WIDTH, PRINT_HEIGHT] });
  // 'MEDIUM' Flate-compresses the embedded image XObject — without it jsPDF
  // stores the RAW uncompressed RGBA bitmap (2000×2400×4 bytes ≈ 19MB for
  // this canvas, ~22× the source PNG's own compressed size; confirmed via a
  // live drive during task-19's verification), which is an unreasonable
  // download for a $19 purchase. 'MEDIUM' brought the same canvas from ~19MB
  // to ~1MB (comparable to the PNG sibling download) with no visible quality
  // loss (a Flate/zlib pass over already-rendered pixels is lossless).
  doc.addImage(dataUrl, 'PNG', 0, 0, PRINT_WIDTH, PRINT_HEIGHT, undefined, 'MEDIUM');
  doc.save(`${slug(design)}.pdf`);
}

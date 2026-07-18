import React, { useId } from 'react';
import Shield, { canRenderLocally } from './Shield.jsx';
import { useCharge, artKey } from './charges/recolor.js';
import { hasArt, artFile } from './charges/manifest.js';
import { tinctureHex, blazon, drawShieldURL, withDefaultAchievement, normalize } from './heraldry.js';
import { findByKey } from './achievement-art/manifest.js';
import { recolorFurniture, innerMarkup, swapPlaceholderFills } from './achievement-art/recolor.js';
import {
  LAYOUT, shieldBox, mantlingBox, helmBox, torseBox, crestBox, supporterBox,
  compartmentBox, mottoBox, torseLiveryHex, mantlingLiveryHex, fitMotto, mottoTextLength,
  aspectFromViewBox, HELM_MATERIAL, COMPARTMENT_MATERIAL, MOTTO_GUIDE_PATH,
} from './achievement-art/layout.js';

// Vendored furniture (bundled in-repo, not R2) — a plain build-time import, no
// hook, no fetch. This is what the brief calls "SSR-trivial": whatever bundles
// this file (Vite today; Task 17's SSR entry point later) resolves these at
// build time, so there is nothing async/browser-only about them. Contrast
// with the crest/supporters below, which DO need the artCache seam (they're
// fetched from R2 at runtime via useCharge).
import royalSvg from './achievement-art/helmet/royal.svg?raw';
import peerSvg from './achievement-art/helmet/peer.svg?raw';
import baronetSvg from './achievement-art/helmet/baronet.svg?raw';
import knightSvg from './achievement-art/helmet/knight.svg?raw';
import esquireSvg from './achievement-art/helmet/esquire.svg?raw';
import torseSvgRaw from './achievement-art/torse/torse.svg?raw';
import mantlingSvgRaw from './achievement-art/mantling/cloak.svg?raw';
import scrollBelowSvgRaw from './achievement-art/motto/scroll-below.svg?raw';
import pedestalSvgRaw from './achievement-art/compartments/pedestal.svg?raw';

const HELM_SVG = { royal: royalSvg, peer: peerSvg, baronet: baronetSvg, knight: knightSvg, esquire: esquireSvg };
const MANTLING_META = findByKey('mantling', 'cloak');
const TORSE_META = findByKey('torse', 'torse');
const COMPARTMENT_META = findByKey('compartments', 'pedestal');
const MOTTO_META = findByKey('motto', 'scroll-below');

const FALLBACK_LIVERY = { colourHex: tinctureHex('Gules'), metalHex: tinctureHex('Argent') };

// ─────────────────────────────────────────────────────────────────────────
// The SSR seam.
//
// `useCharge` (src/charges/recolor.js) fetches R2 charge art client-side via
// `fetch` + `useEffect` — that never resolves under `renderToStaticMarkup`
// (no browser, no network turn). `artCache` is the injectable escape hatch:
// a plain `{ [artKey(file,hex)]: {viewBox, inner} }` map — keyed by the
// TINCTURE-RESOLVED identity (`artKey`, src/charges/recolor.js), not `file`
// alone, because `resolveCharge`/`recolorCharge` bakes `hex` into
// `art.inner`: the same file used in two slots with different tinctures
// (an Or lion on the shield, an Argent lion crest) needs two cache entries,
// not one (review round 1 finding — file-only keying silently collapsed
// same-file/different-tincture slots to whichever resolved last on the OG
// image; on-screen was always correct because `useCharge(file,hex)` recolours
// per-slot regardless of this cache). This is otherwise the exact shape
// `resolveCharge`/`useCharge` already produce — the SAME shape Shield.jsx's
// own `chargeArt` prop uses (Shield.jsx builds the identical `artKey` on its
// own read side), so `artCache` can be passed straight through to `<Shield
// chargeArt={artCache}>` for the shield slot with no adapter. When an entry
// is present for a file+hex pair, `useResolvedArt` skips the hook's fetch
// entirely (passes `null` as the file, mirroring Shield.jsx's own
// `VendoredCharge`) and returns the pre-resolved art synchronously — safe to
// call during SSR. Server callers (Task 17) must pre-resolve every R2
// file+hex pair the achievement's crest + supporters need (via
// `resolveCharge`) and pass them all in one `artCache` object, keyed by
// `artKey(file, hex)`; vendored furniture (helm/torse/mantling/motto/
// compartment) needs no entry — it's always available via the static imports
// above, no seam required.
// ─────────────────────────────────────────────────────────────────────────
function useResolvedArt(file, hex, artCache) {
  const cached = artCache && file ? artCache[artKey(file, hex)] : null;
  const fetched = useCharge(cached ? null : file, hex);
  return cached || fetched;
}

/** Mirror `children`'s content horizontally in place, about `box`'s own
 *  centre line — used for the sinister supporter (brief §1.6: `scale(-1,1)`
 *  about the right anchor; mirroring around the box's own centre keeps it in
 *  the same footprint rather than reflecting off the canvas origin). */
function Mirrored({ box, children }) {
  const cx = box.x + box.w / 2;
  return <g transform={`translate(${cx},0) scale(-1,1) translate(${-cx},0)`}>{children}</g>;
}

/** A recoloured R2 charge (crest or one supporter), positioned into `box`. */
function ArtCharge({ box, art, hex }) {
  if (!art) return null; // graceful blank — matches Shield.jsx's own VendoredCharge philosophy
  return (
    <svg
      x={box.x} y={box.y} width={box.w} height={box.h}
      viewBox={art.viewBox} preserveAspectRatio="xMidYMid meet" fill={hex}
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  );
}

/**
 * The full achievement — mantling, shield, helm, torse, crest, supporters,
 * compartment, and motto scroll — as one fixed-template, deterministic,
 * layered SVG. Renders standalone via `renderToStaticMarkup` (M3's OG image).
 *
 * Props:
 *  - design      the design AST (a Coat); achievement parts are backfilled via
 *                `withDefaultAchievement` so this always renders a full
 *                achievement regardless of how much the caller pre-filled.
 *  - shieldSlot  optional override for the escutcheon slot — a React node
 *                drawn into the shield's 200×240 box INSTEAD of the default
 *                <Shield>/DrawShield-fallback logic (see `ssr` below).
 *  - artCache    optional `{ [artKey(file,hex)]: {viewBox, inner} }` of
 *                pre-resolved R2 charge art (crest + supporters) — the SSR
 *                seam, see above. Keyed by file+hex composite, not file alone.
 *  - ssr         when true, the shield slot ALWAYS renders the local <Shield>
 *                (never the drawshield.net <foreignObject>/<img> fallback,
 *                which does not survive renderToStaticMarkup→resvg) — an
 *                out-of-vocab escutcheon degrades to whatever <Shield> can
 *                draw locally rather than erroring or embedding a raster
 *                that a Node/Workers SVG rasteriser can't resolve.
 *  - width       CSS width of the root svg (default '100%').
 *  - backfill    default true (unchanged prior behaviour: every missing part
 *                is auto-filled). Studio's editing preview (Task 14) passes
 *                `false` — an achievement-editing caller's `design` already
 *                carries the achievement EXACTLY as the user left it, and a
 *                part the user deliberately "set aside" (removed) must render
 *                absent, not silently reappear via the same default-fill this
 *                prop disables. Every other caller (generation preview, the
 *                SSR/OG path, PRESETS which never carry an `achievement` at
 *                all) keeps the default `true` — this is purely additive.
 */
export default function Achievement({ design, shieldSlot = null, artCache = null, ssr = false, width = '100%', backfill = true }) {
  const uid = useId().replace(/[:]/g, '');
  const coat = backfill ? withDefaultAchievement(design) : (normalize(design) || design);
  const a = coat.achievement || {};

  const helmStyle = (a.helm && a.helm.style) || 'esquire';
  const helmMeta = findByKey('helmet', helmStyle) || findByKey('helmet', 'esquire');
  const helmAspect = aspectFromViewBox(helmMeta.viewBox);
  const helmSVG = HELM_SVG[helmStyle] || HELM_SVG.esquire;

  const sb = shieldBox();
  const mb = mantlingBox();
  const hb = helmBox(helmStyle, helmAspect);
  const tb = torseBox(helmStyle, helmAspect);
  const cb = crestBox(helmStyle, helmAspect);

  const hasCompartment = !!a.compartment;
  const compBox = hasCompartment ? compartmentBox() : null;
  const mBox = mottoBox(hasCompartment);

  // ── 1. Mantling — id-based recolour (NOT the silhouette recolour charges
  // use). Only the dexter*/sinister* edge-scallop groups carry tincture ids
  // (Task 8); the large lobe body stays its fixed neutral fill. That reads
  // heraldically fine as-is (the body is a highlight/shading tone, not a flat
  // "wrong colour" patch), so it's left alone rather than force-tinted — see
  // the report for the full options considered.
  const mantlingHex = a.mantling ? mantlingLiveryHex(a.mantling) : FALLBACK_LIVERY;
  const mantlingMarkup = innerMarkup(recolorFurniture(mantlingSvgRaw, MANTLING_META.recolorIds, mantlingHex));

  // ── 4. Torse — SAME id-based recolour, opposite tincture-array order from
  // mantling (torseLiveryHex/mantlingLiveryHex each resolve by the member's
  // OWN documented order — see achievement-art/layout.js).
  const torseHex = a.torse ? torseLiveryHex(a.torse) : FALLBACK_LIVERY;
  const torseMarkup = innerMarkup(recolorFurniture(torseSvgRaw, TORSE_META.recolorIds, torseHex));

  // ── 5. Crest — the SAME R2 charge-art pipeline Shield.jsx uses for shield
  // charges (silhouette recolour via useCharge), reused as-is.
  const crestObj = a.crest && a.crest.object;
  const crestFile = crestObj && hasArt(crestObj.key, crestObj.attitude) ? artFile(crestObj.key, crestObj.attitude) : null;
  const crestHex = a.crest ? tinctureHex(a.crest.tincture) : '#ECE6D8';
  const crestArt = useResolvedArt(crestFile, crestHex, artCache);

  // ── 6. Supporters — dexter/sinister, sinister omitted → matched pair
  // (mirrored dexter art, per achievement.js's typedef).
  const supp = a.supporters || {};
  const dexterMember = supp.dexter || null;
  const sinisterMember = supp.sinister || supp.dexter || null;
  const dexterFile = dexterMember && hasArt(dexterMember.object.key, dexterMember.object.attitude)
    ? artFile(dexterMember.object.key, dexterMember.object.attitude) : null;
  const sinisterFile = sinisterMember && hasArt(sinisterMember.object.key, sinisterMember.object.attitude)
    ? artFile(sinisterMember.object.key, sinisterMember.object.attitude) : null;
  const dexterHex = dexterMember ? tinctureHex(dexterMember.tincture) : '#ECE6D8';
  const sinisterHex = sinisterMember ? tinctureHex(sinisterMember.tincture) : '#ECE6D8';
  const dexterArt = useResolvedArt(dexterFile, dexterHex, artCache);
  const sinisterArt = useResolvedArt(sinisterFile, sinisterHex, artCache);
  const dexterBox = supporterBox('dexter');
  const sinisterBox = supporterBox('sinister');

  // ── 8. Motto — vendored scroll + the motto text clamped to always fit. The
  // text follows its OWN untransformed guide path (MOTTO_GUIDE_PATH), not the
  // vendored asset's internal one (see layout.js) — decouples "does the text
  // sit on a nice curve" from the vendored art's own transform structure.
  const mottoText = fitMotto(coat.motto);
  const textPathId = `motto-path-${uid}`;
  const mottoScrollMarkup = innerMarkup(scrollBelowSvgRaw);

  // ── 2. Shield slot. `ssr` forces the local <Shield> unconditionally — the
  // drawshield.net <foreignObject>/<img> fallback is browser-only (does not
  // survive renderToStaticMarkup→resvg). Achievement furniture is ALWAYS
  // local either way; only the escutcheon itself can ever defer to DrawShield,
  // and toDrawShieldBlazon (model/drawshield.js, §3a) strips the achievement
  // before building that URL, so no achievement clause ever leaks to it.
  const shieldLocal = ssr || canRenderLocally(coat);

  return (
    <svg
      viewBox={`0 0 ${LAYOUT.viewBox.w} ${LAYOUT.viewBox.h}`}
      width={width}
      role="img"
      aria-label={blazon(coat, 'formal')}
      style={{ display: 'block' }}
    >
      {/* 1. Mantling — behind everything, draped from the helm */}
      <svg
        x={mb.x} y={mb.y} width={mb.w} height={mb.h} viewBox={MANTLING_META.viewBox}
        preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: mantlingMarkup }}
      />

      {/* 2. Shield slot — the escutcheon (the hero; everything else steps back) */}
      <svg x={sb.x} y={sb.y} width={sb.w} height={sb.h} viewBox="0 0 200 240" preserveAspectRatio="xMidYMid meet">
        {shieldSlot ? shieldSlot : shieldLocal ? (
          // ariaHidden: the root <svg> above already carries role="img"/aria-label
          // for the WHOLE composition — without this the nested <Shield> would
          // double-read its own blazon on top of it (Task 12 review, folded into
          // Task 14).
          <Shield design={coat} width="100%" chargeArt={artCache} ariaHidden />
        ) : (
          <foreignObject x={0} y={0} width={200} height={240}>
            <img
              src={drawShieldURL(coat, { format: 'png', size: 600 })}
              alt={blazon(coat, 'formal')}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </foreignObject>
        )}
      </svg>

      {/* 3. Helm — seated above the shield. Never livery-tinctured (Task 8/9);
          its own placeholder fills are swapped to a FIXED per-rank material
          (steel/gold/silver) instead — see achievement-art/recolor.js. */}
      <svg
        x={hb.x} y={hb.y} width={hb.w} height={hb.h} viewBox={helmMeta.viewBox}
        preserveAspectRatio="xMidYMid meet"
        dangerouslySetInnerHTML={{ __html: innerMarkup(swapPlaceholderFills(helmSVG, HELM_MATERIAL[helmStyle] || {})) }}
      />

      {/* 4. Torse — across the helm's crown, alternating [metal, colour] */}
      <svg
        x={tb.x} y={tb.y} width={tb.w} height={tb.h} viewBox={TORSE_META.viewBox}
        preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: torseMarkup }}
      />

      {/* 5. Crest — standing on the torse */}
      <ArtCharge box={cb} art={crestArt} hex={crestHex} />

      {/* 6. Supporters — flanking the shield; sinister mirrored */}
      <ArtCharge box={dexterBox} art={dexterArt} hex={dexterHex} />
      {sinisterArt && (
        <Mirrored box={sinisterBox}>
          <ArtCharge box={sinisterBox} art={sinisterArt} hex={sinisterHex} />
        </Mirrored>
      )}

      {/* 7. Compartment — beneath the supporters' feet, when present */}
      {hasCompartment && compBox && (
        <svg
          x={compBox.x} y={compBox.y} width={compBox.w} height={compBox.h} viewBox={COMPARTMENT_META.viewBox}
          preserveAspectRatio="xMidYMid meet"
          dangerouslySetInnerHTML={{ __html: innerMarkup(swapPlaceholderFills(pedestalSvgRaw, COMPARTMENT_MATERIAL)) }}
        />
      )}

      {/* 8. Motto scroll — vendored art + the motto text, clamped to fit */}
      {mottoText && (
        <svg x={mBox.x} y={mBox.y} width={mBox.w} height={mBox.h} viewBox={MOTTO_META.viewBox} preserveAspectRatio="xMidYMid meet">
          <g dangerouslySetInnerHTML={{ __html: mottoScrollMarkup }} />
          <path id={textPathId} d={MOTTO_GUIDE_PATH} fill="none" stroke="none" />
          <text
            textLength={mottoTextLength(mottoText)}
            lengthAdjust="spacingAndGlyphs"
            textAnchor="middle"
            fontFamily="Cormorant Garamond, Georgia, serif"
            fontStyle="italic"
            fontSize={40}
            fill="#2a2320"
          >
            <textPath href={`#${textPathId}`} startOffset="50%">{mottoText}</textPath>
          </text>
        </svg>
      )}
    </svg>
  );
}

// Re-exported (C1, final whole-branch review): the bare-shield export/OG
// composition (src/bareShield.js) needs the SAME <Shield> component this
// file already imports, INJECTED by its caller rather than imported
// directly — export.js (Vite, JSX-capable) imports Shield.jsx itself, but
// the og:image Cloudflare Function can't (no raw .jsx import — see that
// Function's own header re: the `?raw`-suffix bundler gap this
// generated-bundle mechanism already works around for Achievement.jsx
// itself). Piggybacking on the SAME committed, pre-JSX-compiled generated
// bundle (scripts/build-achievement-bundle.mjs) — rather than adding a
// second generated file — means Shield reaches the Function pre-compiled at
// zero extra build-script cost.
export { Shield };

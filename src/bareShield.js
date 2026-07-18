// ─────────────────────────────────────────────────────────────────────────
// C1 fix (final whole-branch review, the merge gate) — the bare-shield
// export/OG composition for a stripAchievement'd design ("Just the shield").
//
// PRE-FIX: src/export.js's `achievementSVG` and functions/api/og/[payload].js's
// `renderAchievementSVG` both rendered `<Achievement>` UNCONDITIONALLY —
// `backfill={false}` only suppresses crest/supporters, but `<Achievement>`
// ALWAYS draws helm/torse/mantling from FALLBACK_LIVERY regardless. So a
// design with NO `achievement` key at all (stripAchievement, Studio's "Just
// the shield" toggle) still shipped a fully helmeted achievement in the free
// PNG, all three $19 clean files, AND the og:image unfurl — even though the
// on-screen preview (Studio.jsx, ShareView.jsx, LibraryCard.jsx — all gate on
// `hasAchievement(coat)`) correctly showed a bare shield. This module is the
// fix: render a bare `<Shield>` instead, mirroring that on-screen split.
//
// Shared by src/export.js (the browser download path, which imports
// src/Shield.jsx directly — Vite compiles its JSX at build time) and
// functions/api/og/[payload].js (the Workers og:image Function, which gets
// Shield via Achievement.jsx's own generated-bundle re-export — see that
// re-export's comment). `Shield` is passed in BY THE CALLER, not imported
// here, so this module itself stays plain JS — no JSX, no `?raw` — and is
// safe to import from either runtime with zero special bundling.
//
// Sized into the achievement's own 1000×1200 canvas (achievement-art/
// layout.js LAYOUT.viewBox) — the SAME canvas `<Achievement>` uses — so every
// downstream step in both callers (export.js's namespace/width/height
// pinning, its free-tier footer band, the OG Function's buildOgSVG
// letterboxing) keeps working UNCHANGED regardless of which branch built the
// inner markup. Shield's own native viewBox (200×240) is exactly the SAME
// 5:6 aspect as the 1000×1200 canvas, so no distortion.
//
// The motto (if present) renders as plain italic text below the shield —
// NOT the vendored motto-scroll graphic `<Achievement>` draws — matching
// exactly what the on-screen bare-shield path shows (ShareView.jsx §
// "the motto beneath"; Studio.jsx's own `!showAchievement` branch).
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { blazon } from './model/blazon.js';
import { LAYOUT } from './achievement-art/layout.js';

const { w: CANVAS_W, h: CANVAS_H } = LAYOUT.viewBox;

// Generous but not edge-to-edge — leaves top/bottom margin plus room below
// for the motto caption, echoing the achievement composition's own sense of
// scale (its shield box is comparably sized relative to the same canvas).
const SHIELD_W = 640;
const SHIELD_H = Math.round((SHIELD_W * 240) / 200); // Shield.jsx's own 200×240 viewBox aspect
const SHIELD_X = (CANVAS_W - SHIELD_W) / 2;
const SHIELD_Y = 120;
const MOTTO_Y = SHIELD_Y + SHIELD_H + 110;

/**
 * The bare-shield composition — a `<Shield>` centred in the achievement's
 * own canvas, plus the motto as plain text beneath it when the design has
 * one. Returns a React element ready for `renderToStaticMarkup`; same root
 * shape (viewBox `0 0 1000 1200`, `width="100%"`, no `height`) as
 * `<Achievement>`'s own root.
 * @param {React.ComponentType} Shield  injected — see file header
 * @param {object} coat  an already-normalized Coat with NO achievement
 * @param {Record<string,{viewBox:string,inner:string}>} artCache  pre-resolved
 *   shield-charge art (resolveAchievementArt already walks `coat.charges`
 *   regardless of achievement presence, so this needs no special-casing)
 */
export function bareShieldElement(Shield, coat, artCache) {
  const mottoText = coat.motto && coat.motto.trim();
  return React.createElement(
    'svg',
    {
      viewBox: `0 0 ${CANVAS_W} ${CANVAS_H}`,
      width: '100%',
      role: 'img',
      'aria-label': blazon(coat, 'formal'),
      style: { display: 'block' },
    },
    React.createElement(
      'svg',
      { x: SHIELD_X, y: SHIELD_Y, width: SHIELD_W, height: SHIELD_H, viewBox: '0 0 200 240', preserveAspectRatio: 'xMidYMid meet' },
      // ariaHidden: the wrapper root above already carries role="img"/aria-label
      // for the whole composition — mirrors Achievement.jsx's own nested
      // shield-slot treatment (Task 12 review).
      React.createElement(Shield, { design: coat, width: '100%', chargeArt: artCache, ariaHidden: true }),
    ),
    mottoText
      ? React.createElement(
          'text',
          {
            x: CANVAS_W / 2, y: MOTTO_Y, textAnchor: 'middle',
            fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic',
            fontSize: 50, fill: '#C9A24B',
          },
          mottoText,
        )
      : null,
  );
}

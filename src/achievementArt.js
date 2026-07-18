// ─────────────────────────────────────────────────────────────────────────
// Art prefetch for the SSR seam — Achievement.jsx's `artCache` prop (see
// .superpowers/sdd/briefs/task-12-report.md, "The SSR seam", the
// load-bearing contract this file implements the server/build side of).
//
// `useCharge`'s fetch-on-mount (src/charges/recolor.js) never runs under
// `renderToStaticMarkup` (no browser tick, no useEffect), so every R2-hosted
// charge file the design actually needs must be resolved BEFORE rendering
// and handed in as one `artCache` map, keyed by `artKey(file, hex)` — the
// tincture-resolved composite identity (src/charges/recolor.js), NOT file
// alone. `resolveCharge` bakes `hex` into `art.inner`, so a design that uses
// the same charge file in more than one slot with DIFFERENT tinctures (an Or
// lion on the shield, an Argent lion crest — same file, different hex) needs
// two distinct cache entries; keying by file alone let the second resolve
// silently overwrite the first (Task 17 review round 1 finding — on-screen
// was never affected, since the browser's `useCharge(file,hex)` recolours
// per-slot regardless of this cache).
//
// LIVES HERE (src/, not functions/_lib/) since Task 19: BOTH the browser
// export path (src/export.js, bundled by Vite) and the Workers og:image
// Function need this exact prefetch — `functions/_lib/achievementArt.js` is
// now a thin re-export of this module so the two callers share ONE
// implementation instead of two copies that can silently drift apart (this
// is also where the Task 17 residual gets fixed, once, for both).
//
// RE-NARROWED (SEC-2, final whole-branch review — reverses task-19's own
// broadening below, which turned out to be an abuse vector): `wantedArt` used
// to walk EVERY `kind:'charge'` entry in `coat.charges` — unbounded for a
// crafted payload, since decodeCoat enforces no array-length cap. Shield.jsx's
// `toShieldView` only ever DRAWS the FIRST such group (`.find()`), so a
// payload with hundreds of distinct catalog keys turned one unauthenticated
// `/api/og` GET into hundreds of concurrent R2 fetches + recolour passes for
// art that never gets composited — the amplifier this closes. Back to
// resolving only what's actually drawn: the first mobile charge group (same
// `.find()` `toShieldView` itself uses), plus the (inherently-bounded-to-one-
// each) crest/dexter/sinister. `/api/og`'s own new per-IP rate limit
// (onRequestGet, this file's sibling) is the other half of SEC-2 — this is
// the fan-out cap; that's the request-rate cap.
//
// (Superseded task-19 rationale, kept for context: a design whose `charges`
// array carried a SECOND `kind:'charge'` entry — a hand-crafted/decoded coat;
// the generation prompt asks for "at most one" but the schema doesn't enforce
// it — left that second group's art unresolved, rendering blank under SSR.
// That gap is real but narrow (never exercised via the Studio editor) and is
// reopened by this revert; SEC-2's abuse vector is the one actually reachable
// by an anonymous caller, so it wins.)
//
// This walks the design EXACTLY as `<Achievement backfill={false}>` will —
// no `withDefaultAchievement` here. Callers that want the backfilled view
// (Studio's live preview, PRESETS) run `withDefaultAchievement` themselves
// before calling in; the og:image Function and the paid/free export both
// deliberately render EXACTLY the stored design, including parts the user
// chose to "set aside" — a silently re-seeded default would show a crest the
// user deleted (Task 14 review finding, folded into task-17's brief as a
// hard requirement, reused as-is here).
// ─────────────────────────────────────────────────────────────────────────

import { normalize } from './model/achievement.js';
import { hasArt, artFile } from './charges/manifest.js';
import { tinctureHex } from './model/tinctures.js';
import { resolveCharge, artKey } from './charges/recolor.js';

/**
 * Every (file, hex) pair the design actually needs art for, matching
 * Achievement.jsx's own gating exactly (hasArt-gated crest/supporters, the
 * matched-pair sinister→dexter fallback) plus the ONE mobile shield charge
 * group Shield.jsx's own `toShieldView` actually draws (`.find()`-picked —
 * SEC-2, final whole-branch review: bounded to what's rendered, not every
 * `kind:'charge'` entry a crafted `charges` array might carry; see this
 * file's header for the fan-out-amplifier this closes).
 * @param {object} coat  an already-normalized Coat (e.g. from decodeCoat)
 */
function wantedArt(coat) {
  const a = coat.achievement || {};
  const wants = [];

  const drawnCharge = (coat.charges || []).find((g) => g.object && g.object.kind === 'charge');
  if (drawnCharge && hasArt(drawnCharge.object.key, drawnCharge.object.attitude)) {
    wants.push({ file: artFile(drawnCharge.object.key, drawnCharge.object.attitude), hex: tinctureHex(drawnCharge.tincture) });
  }

  if (a.crest && a.crest.object && hasArt(a.crest.object.key, a.crest.object.attitude)) {
    wants.push({ file: artFile(a.crest.object.key, a.crest.object.attitude), hex: tinctureHex(a.crest.tincture) });
  }

  const supp = a.supporters || {};
  const dexter = supp.dexter || null;
  const sinister = supp.sinister || supp.dexter || null; // matched pair, mirrors Achievement.jsx
  if (dexter && dexter.object && hasArt(dexter.object.key, dexter.object.attitude)) {
    wants.push({ file: artFile(dexter.object.key, dexter.object.attitude), hex: tinctureHex(dexter.tincture) });
  }
  if (sinister && sinister.object && hasArt(sinister.object.key, sinister.object.attitude)) {
    wants.push({ file: artFile(sinister.object.key, sinister.object.attitude), hex: tinctureHex(sinister.tincture) });
  }

  return wants;
}

/**
 * Resolve every R2 charge file a design's escutcheon (its one drawn mobile
 * charge group) + achievement (crest, both supporters) need, pre-fetched and
 * recoloured — ready to pass straight through as `<Achievement artCache={…}>`.
 * @param {import('./model/types.js').Coat|object} coatInput
 * @returns {Promise<Record<string, {viewBox: string, inner: string}>>} keyed
 *   by `artKey(file, hex)`, not `file` alone — see the file-header note.
 */
export async function resolveAchievementArt(coatInput) {
  const coat = normalize(coatInput) || coatInput;
  const wants = wantedArt(coat);

  const cache = {};
  await Promise.all(
    wants.map(async ({ file, hex }) => {
      const art = await resolveCharge(file, hex);
      if (art) cache[artKey(file, hex)] = art;
    }),
  );
  return cache;
}

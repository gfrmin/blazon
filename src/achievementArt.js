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
// BROADENED (task-19 brief §1, the Task 17 residual): `wantedArt` used to
// resolve only `chargeGroup(coat)` — the SINGLE mobile shield-charge group
// `.find()` returns — so a design whose `charges` array carried a SECOND
// `kind:'charge'` entry (a hand-crafted/decoded coat; the generation prompt
// asks for "at most one" but the schema doesn't enforce it) left that second
// group's art unresolved, rendering blank under SSR. This now walks EVERY
// `kind:'charge'` entry in `coat.charges`, not just the first. (Shield.jsx's
// own `toShieldView` still only ever DRAWS the first such group via its own
// `.find()` — a separate, narrower, deliberately out-of-scope limitation,
// see task-19-report.md — so this widens what gets PRE-FETCHED defensively;
// it costs nothing when there's only one, as there always is today via the
// Studio editor.)
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
 * matched-pair sinister→dexter fallback) plus EVERY mobile shield charge
 * group (Shield.jsx's `chargeArt` prop, passed straight through by
 * Achievement) — not just the one group `chargeGroup()`/`toShieldView` pick.
 * @param {object} coat  an already-normalized Coat (e.g. from decodeCoat)
 */
function wantedArt(coat) {
  const a = coat.achievement || {};
  const wants = [];

  for (const g of coat.charges || []) {
    if (g.object && g.object.kind === 'charge' && hasArt(g.object.key, g.object.attitude)) {
      wants.push({ file: artFile(g.object.key, g.object.attitude), hex: tinctureHex(g.tincture) });
    }
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
 * Resolve every R2 charge file a design's escutcheon (ALL mobile charge
 * groups) + achievement (crest, both supporters) need, pre-fetched and
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

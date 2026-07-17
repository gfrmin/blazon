// ─────────────────────────────────────────────────────────────────────────
// Server-side art prefetch for the SSR seam — Achievement.jsx's `artCache`
// prop (see .superpowers/sdd/briefs/task-12-report.md, "The SSR seam", the
// load-bearing contract this file implements the server side of).
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
// silently overwrite the first, so every slot sharing that file rendered in
// whichever tincture resolved last on the OG image (review round 1 finding —
// on-screen was never affected, since the browser's `useCharge(file,hex)`
// recolours per-slot regardless of this cache). Otherwise this is the exact
// shape `resolveCharge`/`useCharge` already produce, and the SAME shape
// Shield.jsx's own `chargeArt` prop consumes (Shield.jsx builds the same
// `artKey` on its read side). Mirrors src/export.js's `resolveDesignCharges`
// for the shield's own charge, extended to the achievement's crest + both
// supporters.
//
// This walks the design EXACTLY as `<Achievement backfill={false}>` will —
// no `withDefaultAchievement` here. The og:image Function must render
// precisely the stored design, including parts the user deliberately
// removed ("set aside"): a silently re-seeded default would show a crest
// the user chose to delete (Task 14 review finding, folded into task-17's
// brief as a hard requirement).
// ─────────────────────────────────────────────────────────────────────────

import { normalize } from '../../src/model/achievement.js';
import { chargeGroup } from '../../src/model/coat.js';
import { hasArt, artFile } from '../../src/charges/manifest.js';
import { tinctureHex } from '../../src/model/tinctures.js';
import { resolveCharge, artKey } from '../../src/charges/recolor.js';

/**
 * Every (file, hex) pair the design actually needs art for, matching
 * Achievement.jsx's own gating exactly (hasArt-gated crest/supporters, the
 * matched-pair sinister→dexter fallback) plus the escutcheon's own charge
 * (Shield.jsx's `chargeArt` prop, passed straight through by Achievement).
 * @param {object} coat  an already-normalized Coat (e.g. from decodeCoat)
 */
function wantedArt(coat) {
  const a = coat.achievement || {};
  const wants = [];

  const g = chargeGroup(coat);
  if (g && g.object && hasArt(g.object.key, g.object.attitude)) {
    wants.push({ file: artFile(g.object.key, g.object.attitude), hex: tinctureHex(g.tincture) });
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
 * Resolve every R2 charge file a design's escutcheon + achievement (crest,
 * both supporters) need, pre-fetched and recoloured — ready to pass straight
 * through as `<Achievement artCache={…}>`.
 * @param {import('../../src/model/types.js').Coat|object} coatInput
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

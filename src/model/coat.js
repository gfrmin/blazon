// ─────────────────────────────────────────────────────────────────────────
// Coat edits — the single home for reading and mutating the Coat AST.
//
// Every editor (the Studio builder today; generation/marshalling UIs later)
// goes through these pure, immutable helpers instead of hand-spreading the AST,
// so the edit vocabulary lives in exactly one place. They operate on the
// canonical Coat (and tolerate the legacy flat object via normalize()), and
// seed sensible defaults (contrasting tinctures, a charge's default attitude)
// using the model tables — never re-deriving rules the engine already owns.
// ─────────────────────────────────────────────────────────────────────────

import { contrastClass } from './tinctures.js';
import { DIVISIONS } from './field.js';
import { isSubordinary, isPeripheralSubordinary } from './ordinaries.js';
import { defaultAttitudeFor } from './charges.js';
import {
  normalize, hasAchievement, liveryTinctures, withDefaultAchievement, stripAchievement,
} from './achievement.js';

// `|| {}` at the tail so a null/unrecognised input yields an empty coat the
// mutators can safely spread and read `.charges`/`.field` off — normalize(null)
// is null, and `setOrdinary(null)`/selectors must not throw on `.charges`.
const C = (coat) => normalize(coat) || coat || {};
const isStructure = (g) => g.object && (g.object.kind === 'ordinary' || g.object.kind === 'subordinary');
const isMobile = (g) => g.object && g.object.kind === 'charge';

// ── Selectors ──────────────────────────────────────────────────────────────
export const fieldTincture = (coat) => C(coat).field?.tincture ?? null;
export const isDivided = (coat) => !!C(coat).field?.division;
export const division = (coat) => C(coat).field?.division ?? null;
export const primaryGroup = (coat) => (C(coat).charges || []).find(isStructure) ?? null;
export const chargeGroup = (coat) => (C(coat).charges || []).find(isMobile) ?? null;
export const motto = (coat) => C(coat).motto ?? '';

// A tincture that contrasts the field (so a new element reads): metal field →
// a colour, colour field → a metal. Divided/unknown → Or.
function seedContrast(coat) {
  const fc = !isDivided(coat) ? contrastClass(fieldTincture(coat)) : null;
  if (fc === 'metal') return 'Gules';
  if (fc === 'colour') return 'Or';
  return 'Or';
}

// ── Immutable group plumbing ────────────────────────────────────────────────
function updateGroup(coat, pred, fn) {
  let done = false;
  const charges = (coat.charges || []).map((g) => {
    if (!done && pred(g)) { done = true; return fn(g); }
    return g;
  });
  return { ...coat, charges };
}
const removeGroup = (coat, pred) => ({ ...coat, charges: (coat.charges || []).filter((g) => !pred(g)) });
const addGroup = (coat, group) => ({ ...coat, charges: [...(coat.charges || []), group] });

// ── Field ────────────────────────────────────────────────────────────────
export function setFieldTincture(coat, t) {
  return { ...C(coat), field: { tincture: t } }; // drops any division
}

export function setDivision(coat, type) {
  const c = C(coat);
  const meta = DIVISIONS[type] || {};
  if (isDivided(c)) {
    const next = { ...c.field.division, type };
    if (meta.repeat) { if (!next.count) next.count = 6; } else { delete next.count; }
    return { ...c, field: { ...c.field, division: next } };
  }
  const first = fieldTincture(c) || 'Argent';
  const second = contrastClass(first) === 'metal' ? 'Gules' : 'Argent';
  const div = { type, tinctures: [first, second], line: 'straight' };
  if (meta.repeat) div.count = 6;
  return { ...c, field: { division: div } };
}

export function clearDivision(coat) {
  const c = C(coat);
  if (!isDivided(c)) return c;
  return { ...c, field: { tincture: c.field.division.tinctures?.[0] || 'Argent' } };
}

export function setDivisionPart(coat, index, t) {
  const c = C(coat);
  if (!isDivided(c)) return c;
  const tinctures = c.field.division.tinctures.slice();
  tinctures[index] = t;
  return { ...c, field: { ...c.field, division: { ...c.field.division, tinctures } } };
}

export function setDivisionLine(coat, line) {
  const c = C(coat);
  if (!isDivided(c)) return c;
  return { ...c, field: { ...c.field, division: { ...c.field.division, line } } };
}

// ── Structure (ordinary / subordinary) ─────────────────────────────────────
export function setOrdinary(coat, key) {
  const c = C(coat);
  const kind = isSubordinary(key) ? 'subordinary' : 'ordinary';
  // Peripheral subordinaries (bordure, chief, canton…) belong in the trailing
  // "…within a bordure Or" / "…, a chief Or" bucket, not the primary/"between"
  // clause a central ordinary drives — so they carry role 'peripheral'.
  const role = isPeripheralSubordinary(key) ? 'peripheral' : 'primary';
  if (primaryGroup(c)) {
    return updateGroup(c, isStructure, (g) => ({ ...g, role, object: { ...g.object, kind, key } }));
  }
  return addGroup(c, { role, number: 1, tincture: seedContrast(c), object: { kind, key } });
}
export const clearOrdinary = (coat) => removeGroup(C(coat), isStructure);
export const setOrdinaryTincture = (coat, t) => updateGroup(C(coat), isStructure, (g) => ({ ...g, tincture: t }));
export const setOrdinaryLine = (coat, line) =>
  updateGroup(C(coat), isStructure, (g) => ({ ...g, object: { ...g.object, line } }));

// ── Symbol (mobile charge) ─────────────────────────────────────────────────
export function setCharge(coat, key) {
  const c = C(coat);
  const attitude = defaultAttitudeFor(key) || undefined; // reset to valid default on swap
  if (chargeGroup(c)) {
    return updateGroup(c, isMobile, (g) => ({ ...g, object: { kind: 'charge', key, attitude } }));
  }
  return addGroup(c, { role: 'secondary', number: 1, tincture: seedContrast(c), object: { kind: 'charge', key, attitude } });
}
export const clearCharge = (coat) => removeGroup(C(coat), isMobile);
export const setChargeTincture = (coat, t) => updateGroup(C(coat), isMobile, (g) => ({ ...g, tincture: t }));
export const setChargeAttitude = (coat, attitude) =>
  updateGroup(C(coat), isMobile, (g) => ({ ...g, object: { ...g.object, attitude } }));
// Clamp to 6 — the same ceiling the generation tool schema enforces, so a
// hand-edited count can't exceed what the model/renderer treat as valid.
export const setChargeNumber = (coat, n) =>
  updateGroup(C(coat), isMobile, (g) => ({ ...g, number: Math.max(1, Math.min(6, n)) }));
export const setArrangement = (coat, arrangement) =>
  updateGroup(C(coat), isMobile, (g) => ({ ...g, arrangement: arrangement || undefined }));

// ── Motto ──────────────────────────────────────────────────────────────────
export const setMotto = (coat, v) => ({ ...C(coat), motto: v });

// ── Achievement (crest / helm / torse / mantling / supporters / compartment) ─
// Same immutable-edit vocabulary as the shield above, one level out. `withPart`/
// `withoutPart` are the achievement analogue of `updateGroup`/`removeGroup`:
// `withoutPart` drops `achievement` ENTIRELY (not `{}`) once its last member
// goes, since the codec/hash canonicalise on key presence.
const A = (c) => c.achievement || {};
const withPart = (c, part, v) => ({ ...C(c), achievement: { ...A(C(c)), [part]: v } });
function withoutPart(c, part) {
  const coat = C(c);
  const { [part]: _dropped, ...rest } = A(coat);
  if (Object.keys(rest).length === 0) {
    const { achievement: _achievement, ...withoutAchievement } = coat;
    return withoutAchievement;
  }
  return { ...coat, achievement: rest };
}
// Patch a single part with `fn`, or return an (unmutated, still-new) copy of the
// coat when that part isn't set yet — mirrors updateGroup's no-op-but-new-object
// behaviour for setChargeTincture/setChargeAttitude above.
function patchPart(c, part, fn) {
  const coat = C(c);
  const current = A(coat)[part];
  if (current === undefined) return { ...coat };
  return withPart(coat, part, fn(current));
}

// A tincture from THIS coat's own livery (its principal colour + metal, per
// achievement.js's liveryTinctures) rather than a fixed constant — the crest/
// supporters sit outside the field entirely (on a torse / beside the shield),
// so there's no field to contrast against directly; we still avoid matching the
// field's class so the new part doesn't echo a tincture that already reads as
// "the field's colour" at a glance.
function seedLiveryContrast(coat) {
  const { colour, metal } = liveryTinctures(coat);
  const fc = !isDivided(coat) ? contrastClass(fieldTincture(coat)) : null;
  if (fc === 'metal') return colour;
  if (fc === 'colour') return metal;
  return metal;
}

// ── Selectors ──────────────────────────────────────────────────────────────
export const crest = (coat) => A(C(coat)).crest ?? null;
export const helm = (coat) => A(C(coat)).helm ?? null;
export const torse = (coat) => A(C(coat)).torse ?? null;
export const mantling = (coat) => A(C(coat)).mantling ?? null;
export const supporters = (coat) => A(C(coat)).supporters ?? null;
export const compartment = (coat) => A(C(coat)).compartment ?? null;
export { hasAchievement };

// ── Crest ────────────────────────────────────────────────────────────────
export function setCrest(coat, key) {
  const c = C(coat);
  const attitude = defaultAttitudeFor(key) || undefined; // valid default for this charge, or none
  return withPart(c, 'crest', {
    role: 'primary', number: 1, tincture: seedLiveryContrast(c), object: { kind: 'charge', key, attitude },
  });
}
export const setCrestTincture = (coat, t) => patchPart(coat, 'crest', (crestGroup) => ({ ...crestGroup, tincture: t }));
export const setCrestAttitude = (coat, a) =>
  patchPart(coat, 'crest', (crestGroup) => ({ ...crestGroup, object: { ...crestGroup.object, attitude: a } }));
export const clearCrest = (coat) => withoutPart(coat, 'crest');

// ── Helm ─────────────────────────────────────────────────────────────────
export const setHelm = (coat, style) => withPart(C(coat), 'helm', { style });
export const clearHelm = (coat) => withoutPart(coat, 'helm');

// ── Torse / mantling ─────────────────────────────────────────────────────
export const setTorse = (coat, tinctures) => withPart(C(coat), 'torse', { tinctures });
export const setMantling = (coat, tinctures) => withPart(C(coat), 'mantling', { tinctures });
export const clearTorse = (coat) => withoutPart(coat, 'torse');
export const clearMantling = (coat) => withoutPart(coat, 'mantling');

// ── Supporters ───────────────────────────────────────────────────────────
export function setSupporters(coat, key) {
  const c = C(coat);
  const attitude = defaultAttitudeFor(key) || undefined; // e.g. lion → 'rampant', wolf → 'passant', anchor → none
  const dexter = { tincture: seedLiveryContrast(c), object: { kind: 'charge', key, attitude } };
  return withPart(c, 'supporters', { dexter }); // matched pair: sinister absent until diverged
}
// `side` ∈ 'dexter' | 'sinister'. Materialises `sinister` from a clone of
// `dexter` the first time it's touched (so a split pair starts matched, then
// diverges); once both sides exist, each edit only ever touches its own side.
export function setSupporterSide(coat, side, patch) {
  const c = C(coat);
  const supp = A(c).supporters;
  if (!supp || !supp.dexter) return { ...c }; // nothing to diverge from yet
  const base = supp[side] ?? supp.dexter;
  return withPart(c, 'supporters', { ...supp, [side]: { ...base, object: base.object ? { ...base.object } : base.object, ...patch } });
}
export const clearSupporters = (coat) => withoutPart(coat, 'supporters');

// ── Compartment ──────────────────────────────────────────────────────────
export const setCompartment = (coat, type, tincture) => withPart(C(coat), 'compartment', { type, tincture });
export const clearCompartment = (coat) => withoutPart(coat, 'compartment');

// ── Whole achievement ────────────────────────────────────────────────────
// "Just the shield" control uses both: strip to shed the achievement key
// entirely, restore to bring back a full one (filling only what's missing).
export const restoreFullAchievement = withDefaultAchievement;
export { stripAchievement };

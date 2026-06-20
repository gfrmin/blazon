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
import { isSubordinary } from './ordinaries.js';
import { defaultAttitudeFor } from './charges.js';
import { normalize } from './achievement.js';

const C = (coat) => normalize(coat) || coat;
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
  if (primaryGroup(c)) {
    return updateGroup(c, isStructure, (g) => ({ ...g, object: { ...g.object, kind, key } }));
  }
  return addGroup(c, { role: 'primary', number: 1, tincture: seedContrast(c), object: { kind, key } });
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
export const setChargeNumber = (coat, n) =>
  updateGroup(C(coat), isMobile, (g) => ({ ...g, number: Math.max(1, Math.min(8, n)) }));
export const setArrangement = (coat, arrangement) =>
  updateGroup(C(coat), isMobile, (g) => ({ ...g, arrangement: arrangement || undefined }));

// ── Motto ──────────────────────────────────────────────────────────────────
export const setMotto = (coat, v) => ({ ...C(coat), motto: v });

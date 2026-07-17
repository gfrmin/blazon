// ─────────────────────────────────────────────────────────────────────────
// Achievement — the members surrounding the shield, plus AST helpers.
//
// The external achievement is MODELLED now (so the grammar can express a full
// coat) and RENDERED incrementally. The functions here also `normalize()` the
// prototype's flat design object into the canonical Coat shape, so the grammar
// engine (blazon / computeWarn / drawshield) accepts BOTH the legacy object the
// live components still emit and the richer AST — backward-compat by design.
//
// Binding architecture: the design object stays a `Coat`; it gains ONE
// optional member, `coat.achievement` (see ./types.js). There is no wrapping
// `{shield, crest, ...}` object, so every existing consumer that treats the
// coat as the top-level thing (Studio state, the coat.js mutators, normalize,
// presets, the share codec) keeps working untouched.
// ─────────────────────────────────────────────────────────────────────────

import { isMetal, isColour } from './tinctures.js';
import { CHARGES } from './charges.js';

// Helmet ranks. Task 8 vendored art for exactly five DrawShield helmet
// variants (src/achievement-art/manifest.js HELMETS, `rank` field) — this
// table is keyed to those five, not the four the original placeholder assumed.
// `royal` and `peer` sit above the rest by real heraldic convention (a
// sovereign's barred/grille gold helm; a peer's silver helm with its
// distinctive cloth cover). English heraldic authorities actually blazon
// baronets' and knights' helmets identically (steel, open visor) — but
// DrawShield vendors two genuinely different drawings for them (baronet:
// affronty; knight: profile, barred visor open), so they get separate keys
// here with the SAME tier (co-equal rank), not a merged/aliased entry.
// `esquire` (closed steel helm, profile) remains the default and sits at the
// lowest tier — it's the plain, ungranted-honour helm every achievement can
// show without needing a title.
export const HELMETS = {
  esquire: { plain: 'plain steel helmet in profile, visor closed', formal: "an esquire's helmet", tier: 0 },
  knight:  { plain: 'steel helmet in profile, visor open',         formal: "a knight's helmet",    tier: 1 },
  baronet: { plain: 'steel-and-gold helmet, facing forward',       formal: "a baronet's helmet",    tier: 1 },
  peer:    { plain: 'silver helmet in profile, red cap, gold trim', formal: "a peer's helmet",      tier: 2 },
  royal:   { plain: 'gold helmet, facing forward',                 formal: 'a royal helmet',        tier: 3 },
};

// The members of a full achievement, in roughly outside-in order. `motto`
// stays on Coat directly (not here); badge/brisure/augmentation are post-MVP.
export const ACHIEVEMENT_PARTS = ['crest', 'helm', 'torse', 'mantling', 'supporters', 'compartment'];

const isObj = (v) => v != null && typeof v === 'object';

/** True if `d` is the prototype's flat design object (string field + `ordinary`). */
function isLegacy(d) {
  return isObj(d) && typeof d.field === 'string' && 'ordinary' in d;
}

/** True if `d` already looks like a canonical Coat. */
function isCoat(d) {
  return isObj(d) && (
    d.marshalling != null ||
    (isObj(d.field) && (d.field.tincture != null || d.field.division != null)) ||
    (Array.isArray(d.charges) && d.charges.some((g) => isObj(g) && isObj(g.object)))
  );
}

/** Wrap a legacy charge { type, tincture, qty } as a secondary ChargeGroup. */
function legacyChargeGroup(c) {
  return {
    role: 'secondary',
    number: c.qty || 1,
    tincture: c.tincture,
    object: { kind: 'charge', key: c.type },
  };
}

/**
 * Normalize any accepted input into a canonical Coat (or null).
 * Legacy flat object → { field:{tincture}, charges:[primary ordinary, …secondary charges] }.
 * An already-canonical Coat is returned as-is. Carries motto/rationale through.
 */
export function normalize(d) {
  if (!isObj(d)) return null;
  if (isCoat(d)) return d;
  if (isLegacy(d)) {
    const charges = [];
    if (d.ordinary) {
      charges.push({
        role: 'primary',
        number: 1,
        tincture: d.ordinaryTincture,
        object: { kind: 'ordinary', key: d.ordinary },
      });
    }
    for (const c of d.charges || []) charges.push(legacyChargeGroup(c));
    return {
      field: { tincture: d.field },
      charges,
      ...(d.motto ? { motto: d.motto } : {}),
      ...(d.rationale ? { rationale: d.rationale } : {}),
    };
  }
  // A bare partial (e.g. just a field tincture) — coerce defensively.
  if (typeof d.field === 'string') return { field: { tincture: d.field }, charges: d.charges || [] };
  return null;
}

/** Convenience constructor for a plain (single) coat. */
export const coat = (field, charges = []) => ({ field, charges });

/** Convenience constructor for a marshalled coat. */
export const marshal = (type, parts) => ({ marshalling: { type, parts } });

// ─────────────────────────────────────────────────────────────────────────
// Achievement helpers.
//
// Verified: `normalize()` above already passes an achievement-bearing coat
// through untouched for every realistic case — `isCoat()` decides purely from
// `field`/`charges`/`marshalling`, so a real Coat (which always has a field)
// short-circuits to `return d` verbatim, `achievement` and all. No change to
// `normalize()`/`isCoat()` was needed. (The one theoretical gap: a coat with
// an `achievement` but literally no `field`, `charges`, or `marshalling` would
// fail `isCoat()` and fall through to `return null` — but nothing in this
// codebase ever constructs an achievement without a shield underneath it, so
// this is not exercised and is not fixed here.)
// ─────────────────────────────────────────────────────────────────────────

/** True when the normalized coat carries a non-empty `achievement` member. */
export function hasAchievement(d) {
  const c = normalize(d);
  return !!c && isObj(c.achievement) && Object.keys(c.achievement).length > 0;
}

const fieldTinctureCandidates = (field) => {
  if (!isObj(field)) return [];
  if (field.division?.tinctures?.length) return field.division.tinctures;
  if (field.tincture) return [field.tincture];
  return [];
};

/**
 * The coat's principal colour and principal metal — field first, then charges
 * (in array order), skipping furs/proper (rule-neutral, neither class). Falls
 * back to `{ colour: 'Gules', metal: 'Argent' }` for whichever of the two
 * isn't found anywhere on the coat.
 * @param {import('./types.js').Coat|object} coatInput
 * @returns {{colour: import('./types.js').TinctureKey, metal: import('./types.js').TinctureKey}}
 */
export function liveryTinctures(coatInput) {
  const c = normalize(coatInput) || {};
  const candidates = [
    ...fieldTinctureCandidates(c.field),
    ...(c.charges || []).map((g) => g?.tincture),
  ];
  let colour = null;
  let metal = null;
  for (const t of candidates) {
    if (!t) continue;
    if (metal == null && isMetal(t)) { metal = t; continue; }
    if (colour == null && isColour(t)) { colour = t; continue; }
  }
  return { colour: colour ?? 'Gules', metal: metal ?? 'Argent' };
}

// A plain lion rampant Or — the generic heraldic filler when no charge on the
// coat gives a crest/supporter something better to echo.
const LION_RAMPANT_OR_OBJECT = { kind: 'charge', key: 'lion', attitude: 'rampant' };

const isMobileGroup = (g) => g?.object?.kind === 'charge';
const isBeastGroup = (g) => isMobileGroup(g) && CHARGES[g.object.key]?.category === 'beast';

/** The coat's principal mobile charge group (first `kind:'charge'` group), or null. */
const principalCharge = (c) => (c.charges || []).find(isMobileGroup) ?? null;

/** The coat's principal beast charge group (first `kind:'charge'` beast), or null. */
const principalBeast = (c) => (c.charges || []).find(isBeastGroup) ?? null;

function defaultCrest(c) {
  const g = principalCharge(c);
  if (g) return { role: g.role, number: 1, tincture: g.tincture, object: g.object };
  return { role: 'primary', number: 1, tincture: 'Or', object: LION_RAMPANT_OR_OBJECT };
}

function defaultSupporters(c) {
  const g = principalBeast(c);
  const dexter = g
    ? { tincture: g.tincture, object: g.object }
    : { tincture: 'Or', object: LION_RAMPANT_OR_OBJECT };
  return { dexter };
}

/**
 * Returns a coat with a full achievement, filling only the parts that are
 * missing (never overwriting what's already there) — idempotent: applying it
 * twice deep-equals applying it once. `compartment` is never defaulted (off
 * by default in MVP); it's only kept if already present.
 * @param {import('./types.js').Coat|object} coatInput
 * @returns {import('./types.js').Coat}
 */
export function withDefaultAchievement(coatInput) {
  const c = normalize(coatInput);
  if (!c) return coatInput;
  const existing = isObj(c.achievement) ? c.achievement : {};
  const liveries = liveryTinctures(c);
  const achievement = {
    crest: existing.crest ?? defaultCrest(c),
    helm: existing.helm ?? { style: 'esquire' },
    torse: existing.torse ?? { tinctures: [liveries.metal, liveries.colour] },
    mantling: existing.mantling ?? { tinctures: [liveries.colour, liveries.metal] },
    supporters: existing.supporters ?? defaultSupporters(c),
    ...(Object.prototype.hasOwnProperty.call(existing, 'compartment') ? { compartment: existing.compartment } : {}),
  };
  return { ...c, achievement };
}

/**
 * A coat with the `achievement` key removed entirely (not set to `undefined`)
 * so codec/hash canonicalisation stays clean.
 * @param {import('./types.js').Coat|object} coatInput
 * @returns {import('./types.js').Coat}
 */
export function stripAchievement(coatInput) {
  const c = normalize(coatInput) || coatInput;
  if (!isObj(c) || !('achievement' in c)) return c;
  const { achievement: _achievement, ...rest } = c;
  return rest;
}

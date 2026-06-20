// ─────────────────────────────────────────────────────────────────────────
// Achievement — the members surrounding the shield, plus AST helpers.
//
// The external achievement is MODELLED now (so the grammar can express a full
// coat) and RENDERED incrementally. The functions here also `normalize()` the
// prototype's flat design object into the canonical Coat shape, so the grammar
// engine (blazon / computeWarn / drawshield) accepts BOTH the legacy object the
// live components still emit and the richer AST — backward-compat by design.
// ─────────────────────────────────────────────────────────────────────────

// Helmet types (rank/style); modelled for Serious-tier achievements.
export const HELMETS = {
  tournament: { plain: 'tournament helm', tier: 3 },
  barred:     { plain: 'barred helm',     tier: 3 },
  esquire:    { plain: "esquire's helm",  tier: 3 },
  pot:        { plain: 'pot helm',        tier: 3 },
};

// The members of a full achievement, in roughly outside-in order.
export const ACHIEVEMENT_PARTS = [
  'crest', 'helm', 'wreath', 'mantling', 'supporters',
  'compartment', 'motto', 'badge', 'brisure', 'augmentation',
];

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

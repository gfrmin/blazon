// ─────────────────────────────────────────────────────────────────────────
// Ordinaries & subordinaries — the geometric charges derived from shield geometry.
//
// ORDINARIES keeps the prototype's six (with their original `.plain` glosses, so
// the live render and blazon are unchanged) and adds metadata: `formalPl` (the
// plural noun) and `diminutive` (the reduced form used when several appear —
// bar←fess, bendlet←bend …). SUBORDINARIES are the peripheral/enclosed geometrics
// (chief, canton, bordure, orle…). `tier` is the disclosure depth.
// ─────────────────────────────────────────────────────────────────────────

export const ORDINARIES = {
  saltire: { plain: 'diagonal cross',  formalPl: 'saltires',  tier: 1 },
  cross:   { plain: 'cross',           formalPl: 'crosses',   tier: 1 },
  fess:    { plain: 'horizontal band', formalPl: 'fesses',    tier: 0, diminutive: 'bar' },
  pale:    { plain: 'vertical band',   formalPl: 'pales',     tier: 1, diminutive: 'pallet' },
  bend:    { plain: 'diagonal band',   formalPl: 'bends',     tier: 1, diminutive: 'bendlet' },
  chevron: { plain: 'chevron',         formalPl: 'chevrons',  tier: 0, diminutive: 'chevronel' },
  pile:    { plain: 'wedge',           formalPl: 'piles',     tier: 3 },
};
// Prototype order — drives the structure selector; unchanged.
export const ORDINARY_ORDER = ['saltire', 'cross', 'fess', 'pale', 'bend', 'chevron'];

// The reduced ("diminutive") noun used when an ordinary appears in multiples
// lives on each ORDINARIES entry's `diminutive` field — the single source
// `ordinaryNoun` reads. (A standalone DIMINUTIVES map used to duplicate that
// data; it was unreferenced and drifted — e.g. it alone carried cross→crosslet,
// which is a distinct charge, not a repeated cross — so it was removed.)

export const SUBORDINARIES = {
  // `peripheral`: sits at the edge/around the field (not a central charge) — the
  //   serializer blazons it in its own bucket, after the primary/secondary clause.
  // `enclosing`: surrounds the whole field, so it reads "…within a bordure Or"
  //   rather than being merely apposed ("…, a chief Or").
  // `formal`: the singular noun when it differs from the key (flaunches → flaunch).
  chief:        { plain: 'band across the top', formalPl: 'chiefs',        tier: 2, peripheral: true },
  canton:       { plain: 'small corner square', formalPl: 'cantons',       tier: 3, peripheral: true },
  bordure:      { plain: 'border',              formalPl: 'bordures',      tier: 2, peripheral: true, enclosing: true },
  orle:         { plain: 'inner border',        formalPl: 'orles',         tier: 3, peripheral: true, enclosing: true },
  tressure:     { plain: 'inner frame',         formalPl: 'tressures',     tier: 3, peripheral: true, enclosing: true },
  inescutcheon: { plain: 'small shield',        formalPl: 'inescutcheons', tier: 3 },
  quarter:      { plain: 'corner quarter',      formalPl: 'quarters',      tier: 3, peripheral: true },
  gyron:        { plain: 'triangle from centre', formalPl: 'gyrons',       tier: 3 },
  flaunches:    { plain: 'side arcs',           formalPl: 'flaunches',     tier: 3, peripheral: true, formal: 'flaunch' },
  fret:         { plain: 'interlaced bands',    formalPl: 'frets',         tier: 3 },
  billet:       { plain: 'upright rectangle',   formalPl: 'billets',       tier: 3 },
  annulet:      { plain: 'ring',                formalPl: 'annulets',      tier: 3 },
};

export const isOrdinary = (key) => Object.prototype.hasOwnProperty.call(ORDINARIES, key);
export const isSubordinary = (key) => Object.prototype.hasOwnProperty.call(SUBORDINARIES, key);
/** A subordinary that surrounds the whole field (bordure/orle/tressure) → "within a …". */
export const isEnclosingSubordinary = (key) => !!SUBORDINARIES[key]?.enclosing;
/** A subordinary that belongs in the trailing peripheral bucket (edge/around the field). */
export const isPeripheralSubordinary = (key) => !!SUBORDINARIES[key]?.peripheral;

/** The blazon noun for an ordinary/subordinary, singular or plural (diminutive-aware). */
export function ordinaryNoun(key, { plural = false, diminutive = false } = {}) {
  const sub = SUBORDINARIES[key];
  if (sub) return plural ? sub.formalPl : (sub.formal || key);
  const o = ORDINARIES[key];
  if (!o) return key;
  if ((diminutive || plural) && o.diminutive) {
    return plural ? `${o.diminutive}s` : o.diminutive;
  }
  return plural ? o.formalPl : key;
}

/** The plain-English gloss for an ordinary/subordinary ("horizontal band", "border"). */
export function ordinaryPlain(key) {
  return ORDINARIES[key]?.plain || SUBORDINARIES[key]?.plain || key;
}

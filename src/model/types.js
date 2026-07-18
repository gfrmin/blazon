// ─────────────────────────────────────────────────────────────────────────
// Blazon — AST type definitions (JSDoc typedefs; this file emits no runtime code).
//
// The canonical source of truth is a `Coat` (a single shield) or a `Coat` whose
// `marshalling` field combines several coats. The UI is a progressive-disclosure
// VIEW over this AST; the formal blazon and the plain-English translation are both
// DERIVED from it (see ./blazon.js), never stored.
//
// Grounded in the canonical blazon hierarchy (field → primary → secondary →
// tertiary → peripheral → brisure → augmentation) and DrawShield's blazonML model.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {('metal'|'colour'|'fur'|'proper'|'stain')} TinctureClass
 * @typedef {string} TinctureKey  A key into TINCTURES (e.g. 'Or', 'Azure', 'Ermine'), or 'proper'.
 * @typedef {string} LineKey      A key into LINES (e.g. 'straight', 'wavy', 'engrailed').
 */

/**
 * A division of the field (party per X, or a repeating pattern like paly/chequy).
 * @typedef {Object} Division
 * @property {string} type           A key into DIVISIONS ('per pale', 'quarterly', 'paly', …).
 * @property {LineKey} [line]        Line of partition along the division.
 * @property {TinctureKey[]} tinctures  The component tinctures, in dexter-chief-first order.
 * @property {number} [count]        For repeating divisions: number of pieces ("paly of six").
 */

/**
 * The field (background) of a coat.
 * @typedef {Object} Field
 * @property {TinctureKey} [tincture]   When undivided.
 * @property {Division} [division]      When divided/varied.
 * @property {{type:string, of?:string, tincture?:TinctureKey}} [treatment]  semy/fretty/masoned…
 */

/**
 * The object carried by a charge group: an ordinary, a subordinary, or a mobile charge.
 * @typedef {Object} ChargeObject
 * @property {('ordinary'|'subordinary'|'charge')} kind
 * @property {string} key            A key into ORDINARIES / SUBORDINARIES / CHARGES.
 * @property {boolean} [diminutive]   Render/blazon as the diminutive (bar, bendlet…).
 * @property {LineKey} [line]         For ordinaries/subordinaries: line of partition.
 * @property {boolean} [cotised]      For ordinaries: flanked by cotises.
 * @property {string} [variant]       Charge subtype (e.g. 'couped', 'displayed').
 * @property {string} [attitude]      For animate charges: 'rampant', 'passant', 'naiant'…
 * @property {string} [treatment]     Charge modifier (e.g. 'inverted', 'reversed').
 */

/**
 * A group of identical charges sharing a tincture and arrangement.
 * @typedef {Object} ChargeGroup
 * @property {('primary'|'secondary'|'tertiary'|'peripheral')} role  Precedence = blazon order.
 * @property {number} number         How many (1 → "a/an").
 * @property {TinctureKey} tincture
 * @property {ChargeObject} object
 * @property {string} [arrangement]  'in pale' | 'in fess' | 'in chief' | '2 and 1' …
 * @property {number} [on]           Index into the parent coat's charges[] (tertiary "on the …").
 */

/**
 * A single coat of arms (one shield), or a marshalled combination of coats.
 * @typedef {Object} Coat
 * @property {Field} [field]
 * @property {ChargeGroup[]} [charges]
 * @property {{type:string, parts:Coat[]}} [marshalling]  quarterly | impaled | per-X.
 * @property {string} [motto]
 * @property {Achievement} [achievement]  The external achievement (crest/helm/…) surrounding the shield.
 * @property {Object} [rationale]    Friendly per-element copy (Gifter cards).
 */

/**
 * A single supporter (dexter or sinister), standing beside the shield.
 * @typedef {Object} Supporter
 * @property {TinctureKey} tincture
 * @property {ChargeObject} object     kind 'charge'; attitude usually 'rampant'
 */

/**
 * The achievement — the members surrounding the shield. Modelled as an optional
 * member of Coat (see `coat.achievement`), not a wrapping object, so every
 * existing Coat consumer (normalize, the share codec, coat.js mutators) keeps
 * working untouched. Badge/brisure/augmentation are post-MVP and intentionally
 * absent from this typedef.
 * @typedef {Object} Achievement
 * @property {ChargeGroup} [crest]     role ignored; number usually 1
 * @property {{style:string}} [helm]   style ∈ HELMETS keys
 * @property {{tinctures:TinctureKey[]}} [torse]      [metal, colour]
 * @property {{tinctures:TinctureKey[]}} [mantling]   [colour, metal]
 * @property {{dexter:Supporter, sinister?:Supporter}} [supporters]  sinister omitted → matched pair
 * @property {{type?:string, tincture?:TinctureKey}} [compartment]
 */

export {};

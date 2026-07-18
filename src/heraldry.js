// ─────────────────────────────────────────────────────────────────────────
// Blazon — heraldic model & grammar engine (public barrel).
//
// The model now lives in ./model/* as a complete blazon AST (field/divisions/
// furs, ordinaries+diminutives+subordinaries, charges+attitudes, marshalling,
// and the external achievement). This file re-exports it under the names the
// app already uses, so the components keep working unchanged, and adds the
// app-specific helpers that aren't part of the core grammar (the contrast
// engine, the landing hero cycling sets, and the Gifter presets).
//
// The design object is the source of truth; blazon() and computeWarn() accept
// BOTH the legacy flat object and the richer Coat AST (see ./model/achievement).
// ─────────────────────────────────────────────────────────────────────────

// ── Core model (re-exported) ────────────────────────────────────────────────
export {
  TINCTURES, TINCTURE_ORDER, METALS, COLOURS, FURS, STAINS, PROPER, cap,
  tinctureClass, contrastClass, isMetal, isColour,
  tinctureFormal, tincturePlain, tinctureHex,
} from './model/tinctures.js';
export { LINES, LINE_ORDER, DIVISIONS, DIVISION_ORDER, TREATMENTS } from './model/field.js';
export { ORDINARIES, ORDINARY_ORDER, SUBORDINARIES, ordinaryNoun } from './model/ordinaries.js';
export {
  CHARGES, CHARGE_ORDER, ATTITUDES,
  categoryOf, validAttitudesFor, defaultAttitudeFor, attitudeValid, chargeNoun, chargePlain,
} from './model/charges.js';
export {
  HELMETS, ACHIEVEMENT_PARTS, normalize, coat, marshal,
  hasAchievement, liveryTinctures, withDefaultAchievement, stripAchievement,
} from './model/achievement.js';
export * from './model/coat.js'; // selectors + immutable mutators (single home for AST edits)
export { blazon } from './model/blazon.js';
export { computeWarn } from './model/validate.js';
export { toDrawShieldBlazon, drawShieldURL } from './model/drawshield.js';

import { METALS, COLOURS, contrastClass } from './model/tinctures.js';

// ── The contrast engine (keeps generated/cycled designs tincture-rule valid) ─
// metal field → must use a colour; colour field → must use a metal. A neutral
// field (fur / proper / unknown key) has no class to oppose, so it falls to the
// metals pool — metals read cleanly over anything, and `contrastClass` never
// throws on an out-of-table key the way `TINCTURES[field].cls` did.
export function contrastPool(field) {
  return contrastClass(field) === 'metal' ? COLOURS : METALS;
}
export function pickContrast(field, avoid) {
  const pool = contrastPool(field);
  const opts = pool.filter((t) => t !== avoid);
  const from = opts.length ? opts : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// ── Hero (landing) cycling sets ──────────────────────────────────────────────
export const HERO_FIELDS = ['Gules', 'Azure', 'Vert', 'Purpure', 'Sable', 'Or', 'Argent'];
// When the visitor takes control of the hero shield, SYMBOL cycles the REAL
// vocabulary — figural charges (recoloured R2 art) first, geometric after — so
// "take control" never drops back to four abstract shapes. `null` (no charge) is
// LAST. Every figural key here must exist in CHARGE_ART (so it renders locally).
export const HERO_SYMBOLS = [
  { type: 'lion', qty: 1 },
  { type: 'eagle', qty: 1 },
  { type: 'rose', qty: 3 },
  { type: 'stag', qty: 1 },
  { type: 'tower', qty: 1 },
  { type: 'anchor', qty: 1 },
  { type: 'dragon', qty: 1 },
  { type: 'fleurdelys', qty: 3 },
  { type: 'mullet', qty: 3 },
  { type: 'crescent', qty: 2 },
  { type: 'roundel', qty: 1 },
  { type: 'lozenge', qty: 3 },
  null,
];

export const HERO_INITIAL = {
  field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or',
  charges: [{ type: 'mullet', tincture: 'Argent', qty: 3 }],
};

// ── The landing "generative reel" ────────────────────────────────────────────
// Auto-rotating proof of the promise: a described person → a finished coat (a
// figural charge from the R2 art library + a motto + a one-line reason). Each
// scene is deliberately distinct (field, charge family, metal) so the rotation
// shows the RANGE the single interactive shield never could. Designs use the
// legacy flat shape Shield accepts; `ordinary: null` is required so normalize()
// treats them as legacy (it keys on the presence of `ordinary`). All scenes are
// colour-field + metal-charge — tincture-rule valid (computeWarn → null).
export const REEL = [
  {
    sentence: 'A grandmother who spent her whole life by the sea.',
    design: { field: 'Azure', ordinary: null, charges: [{ type: 'anchor', tincture: 'Argent', qty: 1 }] },
    motto: 'Hold fast',
    reason: 'An anchor, for a life lived by the sea.',
  },
  {
    sentence: 'Three generations of soldiers — bold, fierce, and proud.',
    design: { field: 'Gules', ordinary: null, charges: [{ type: 'lion', tincture: 'Or', qty: 1, attitude: 'rampant' }] },
    motto: 'Without fear',
    reason: 'A lion rampant, for courage handed down the line.',
  },
  {
    sentence: 'A gardener who could coax anything into bloom.',
    design: { field: 'Vert', ordinary: null, charges: [{ type: 'rose', tincture: 'Or', qty: 3 }] },
    motto: 'By patient hands',
    reason: 'Three roses, for a garden she made bloom.',
  },
  {
    sentence: 'A teacher who loved the wild and walked it every weekend.',
    design: { field: 'Sable', ordinary: null, charges: [{ type: 'stag', tincture: 'Argent', qty: 1 }] },
    motto: 'Tread lightly',
    reason: 'A stag, for a gentle, untamed spirit.',
  },
  {
    sentence: 'A builder who raised homes with his own hands.',
    design: { field: 'Purpure', ordinary: null, charges: [{ type: 'tower', tincture: 'Or', qty: 1 }] },
    motto: 'Built to last',
    reason: 'A tower, for steady hands and solid ground.',
  },
];

// ── Gifter presets ───────────────────────────────────────────────────────────
// PROTOTYPE ONLY. In production, replace generation with a Claude API call
// (claude-sonnet-4-6) that returns a design object and self-validates against
// the tincture rule (spec §6.1). Authored as canonical Coats (the flat shape no
// longer appears in the data layer; `normalize()` remains only for legacy input).
const primaryOrdinary = (key, tincture) => ({ role: 'primary', number: 1, tincture, object: { kind: 'ordinary', key } });
const secondaryCharge = (key, tincture, number) => ({ role: 'secondary', number, tincture, object: { kind: 'charge', key } });

export const PRESETS = [
  {
    chip: 'Scottish · stars · the steady matriarch',
    desc: 'My grandmother was from the Highlands of Scotland. She loved astronomy and the night sky, and she was the steady one who held the whole family together.',
    design: {
      field: { tincture: 'Azure' },
      charges: [primaryOrdinary('saltire', 'Argent'), secondaryCharge('mullet', 'Or', 2)],
      motto: 'Steadfast through the dark',
      rationale: {
        field: 'Azure — the deep blue of a clear Highland night.',
        ordinary: 'The saltire is the cross of Saint Andrew, patron of Scotland — for her roots.',
        charges: 'Two stars for her love of astronomy, and the way she helped the family find its way.',
      },
    },
  },
  {
    chip: 'A builder · patient, dependable hands',
    desc: 'My dad spent his life building homes with his own hands. Patient, dependable, never flashy — the person everyone in the family leaned on.',
    design: {
      field: { tincture: 'Vert' },
      charges: [primaryOrdinary('chevron', 'Or'), secondaryCharge('roundel', 'Argent', 3)],
      motto: 'By patient hands',
      rationale: {
        field: 'Vert — green for growth and the steady, living work of building.',
        ordinary: 'The chevron echoes a rooftop — the rafters of every home he raised.',
        charges: 'Three simple discs, solid and plain, for dependability.',
      },
    },
  },
  {
    chip: 'Bold · a long military line',
    desc: 'Our family has a long military tradition, three generations of soldiers. Bold, fierce, and proud of where we come from.',
    design: {
      field: { tincture: 'Gules' },
      charges: [primaryOrdinary('cross', 'Or'), secondaryCharge('mullet', 'Argent', 1)],
      motto: 'Without fear',
      rationale: {
        field: 'Gules — red, the colour of courage and long service.',
        ordinary: 'A cross Or, an ancient mark of honour borne into battle.',
        charges: 'A single star for the spark of valour passed down the line.',
      },
    },
  },
];

// A light keyword match over the free-text description — the canned-preset
// fallback used when generation fails/is unavailable (Studio.jsx's
// generate()). Preset CHIPS bypass this entirely (Task 15's selectPreset
// paints a picked preset straight away, no generate() call at all), so this
// only ever sees real describe-step text.
export function pickPreset(text) {
  const t = (text || '').toLowerCase();
  if (/build|home|garden|steady|craft|farm|patient|carpenter/.test(t)) return PRESETS[1];
  if (/militar|bold|fierce|fight|soldier|brave|war|proud/.test(t)) return PRESETS[2];
  return PRESETS[0];
}

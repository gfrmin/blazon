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
export { ORDINARIES, ORDINARY_ORDER, DIMINUTIVES, SUBORDINARIES, ordinaryNoun } from './model/ordinaries.js';
export {
  CHARGES, CHARGE_ORDER, ATTITUDES,
  categoryOf, validAttitudesFor, defaultAttitudeFor, attitudeValid, chargeNoun, chargePlain,
} from './model/charges.js';
export { HELMETS, ACHIEVEMENT_PARTS, normalize, coat, marshal } from './model/achievement.js';
export { blazon } from './model/blazon.js';
export { computeWarn } from './model/validate.js';
export { toDrawShieldBlazon, drawShieldURL } from './model/drawshield.js';

import { TINCTURES, METALS, COLOURS } from './model/tinctures.js';

// ── The contrast engine (keeps generated/cycled designs tincture-rule valid) ─
// metal field → must use a colour; colour field → must use a metal.
export function contrastPool(field) {
  return TINCTURES[field].cls === 'metal' ? COLOURS : METALS;
}
export function pickContrast(field, avoid) {
  const pool = contrastPool(field);
  const opts = pool.filter((t) => t !== avoid);
  const from = opts.length ? opts : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// ── Hero (landing) cycling sets ──────────────────────────────────────────────
export const HERO_FIELDS = ['Gules', 'Azure', 'Vert', 'Purpure', 'Sable', 'Or', 'Argent'];
// `null` (no charge) is intentionally LAST so first-time visitors land on real charges.
export const HERO_SYMBOLS = [
  { type: 'mullet', qty: 3 },
  { type: 'crescent', qty: 2 },
  { type: 'roundel', qty: 1 },
  { type: 'mullet', qty: 2 },
  { type: 'lozenge', qty: 3 },
  { type: 'crescent', qty: 1 },
  { type: 'roundel', qty: 3 },
  null,
];

export const HERO_INITIAL = {
  field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or',
  charges: [{ type: 'mullet', tincture: 'Argent', qty: 3 }],
};

// ── Gifter presets ───────────────────────────────────────────────────────────
// PROTOTYPE ONLY. In production, replace generation with a Claude API call
// (claude-sonnet-4-6) that returns a design object and self-validates against
// the tincture rule (spec §6.1). These canned results keep the prototype real.
export const PRESETS = [
  {
    chip: 'Scottish · stars · the steady matriarch',
    desc: 'My grandmother was from the Highlands of Scotland. She loved astronomy and the night sky, and she was the steady one who held the whole family together.',
    design: {
      field: 'Azure', ordinary: 'saltire', ordinaryTincture: 'Argent',
      charges: [{ type: 'mullet', tincture: 'Or', qty: 2 }],
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
      field: 'Vert', ordinary: 'chevron', ordinaryTincture: 'Or',
      charges: [{ type: 'roundel', tincture: 'Argent', qty: 3 }],
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
      field: 'Gules', ordinary: 'cross', ordinaryTincture: 'Or',
      charges: [{ type: 'mullet', tincture: 'Argent', qty: 1 }],
      motto: 'Without fear',
      rationale: {
        field: 'Gules — red, the colour of courage and long service.',
        ordinary: 'A cross Or, an ancient mark of honour borne into battle.',
        charges: 'A single star for the spark of valour passed down the line.',
      },
    },
  },
];

// Deterministic when an example chip was used (selectedPreset index); otherwise
// a light keyword match. Replace wholesale with the API call in production.
export function pickPreset(text, selectedPreset) {
  if (selectedPreset != null) return PRESETS[selectedPreset];
  const t = (text || '').toLowerCase();
  if (/build|home|garden|steady|craft|farm|patient|carpenter/.test(t)) return PRESETS[1];
  if (/militar|bold|fierce|fight|soldier|brave|war|proud/.test(t)) return PRESETS[2];
  return PRESETS[0];
}

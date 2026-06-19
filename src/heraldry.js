// ─────────────────────────────────────────────────────────────────────────
// Blazon — heraldic data model and grammar engine.
//
// The "design object" is the source of truth (a small AST). The UI is a view
// over it. Both the formal blazon ("Gules, a chevron Or between three mullets
// argent") and the plain-English translation are DERIVED from it, never stored
// separately in the prototype. In production, the AI returns both strings too
// (see blazon-app-spec.md §6.1) — keep them, but this engine is the fallback /
// client-side renderer.
//
// Design object shape:
//   {
//     field: 'Azure',                // a tincture name
//     ordinary: 'saltire',           // an ordinary key
//     ordinaryTincture: 'Argent',    // a tincture name
//     charges: [{ type:'mullet', tincture:'Or', qty:2 }],  // 0 or 1 in this round
//     motto: 'Steadfast through the dark',
//     rationale: { field:'…', ordinary:'…', charges:'…' }, // friendly copy
//   }
// ─────────────────────────────────────────────────────────────────────────

// The tinctures ARE the palette (UI chrome is derived from them — see Shield + components).
export const TINCTURES = {
  Or:      { hex: '#D4AF52', plain: 'gold',   cls: 'metal'  },
  Argent:  { hex: '#E7E1D3', plain: 'silver', cls: 'metal'  },
  Gules:   { hex: '#9F2C2C', plain: 'red',    cls: 'colour' },
  Azure:   { hex: '#1F4E7A', plain: 'blue',   cls: 'colour' },
  Sable:   { hex: '#15151C', plain: 'black',  cls: 'colour' },
  Vert:    { hex: '#2E5A3E', plain: 'green',  cls: 'colour' },
  Purpure: { hex: '#5A3A6B', plain: 'purple', cls: 'colour' },
};
export const TINCTURE_ORDER = ['Or', 'Argent', 'Gules', 'Azure', 'Sable', 'Vert', 'Purpure'];

// Ordinaries — `.plain` is the plain-English noun WITHOUT a leading article
// (the article is added by blazon() so "with a gold chevron" reads correctly).
export const ORDINARIES = {
  saltire: { plain: 'diagonal cross' },
  cross:   { plain: 'cross' },
  fess:    { plain: 'horizontal band' },
  pale:    { plain: 'vertical band' },
  bend:    { plain: 'diagonal band' },
  chevron: { plain: 'chevron' },
};
export const ORDINARY_ORDER = ['saltire', 'cross', 'fess', 'pale', 'bend', 'chevron'];

// Charges (mobile). `.label` is the friendly UI label; formal/plural terms below.
export const CHARGES = {
  mullet:   { label: 'Star',     formal: 'mullet',   formalPl: 'mullets',   plain: 'star',          plainPl: 'stars' },
  crescent: { label: 'Crescent', formal: 'crescent', formalPl: 'crescents', plain: 'crescent moon', plainPl: 'crescent moons' },
  roundel:  { label: 'Disc',     formal: 'roundel',  formalPl: 'roundels',  plain: 'disc',          plainPl: 'discs' },
  lozenge:  { label: 'Diamond',  formal: 'lozenge',  formalPl: 'lozenges',  plain: 'diamond',       plainPl: 'diamonds' },
};
export const CHARGE_ORDER = ['mullet', 'crescent', 'roundel', 'lozenge'];

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const numWord = (n) => ['', 'a', 'two', 'three', 'four'][n] || String(n);

// ── Blazon derivation ──────────────────────────────────────────────────────
export function blazon(d, lang) {
  if (!d) return '';
  if (lang === 'formal') {
    let s = d.field + ', a ' + d.ordinary + ' ' + d.ordinaryTincture.toLowerCase();
    if (d.charges && d.charges.length) {
      const ch = d.charges[0];
      const n = ch.qty || 1;
      const term = n > 1 ? CHARGES[ch.type].formalPl : CHARGES[ch.type].formal;
      s += ' between ' + numWord(n) + ' ' + term + ' ' + ch.tincture.toLowerCase();
    }
    return s;
  }
  // plain English
  let s = 'A ' + TINCTURES[d.field].plain + ' shield with a ' +
    TINCTURES[d.ordinaryTincture].plain + ' ' + ORDINARIES[d.ordinary].plain;
  if (d.charges && d.charges.length) {
    const ch = d.charges[0];
    const n = ch.qty || 1;
    const term = n > 1 ? CHARGES[ch.type].plainPl : CHARGES[ch.type].plain;
    s += ', and ' + numWord(n) + ' ' + TINCTURES[ch.tincture].plain + ' ' + term;
  }
  return s + '.';
}

// ── Tincture-rule validation ───────────────────────────────────────────────
// Metal must not sit on metal, nor colour on colour. Returns a plain-English
// message (string) or null. Non-blocking in the UI (warning, not hard stop).
export function computeWarn(d) {
  if (!d) return null;
  const fc = TINCTURES[d.field].cls;
  const oc = TINCTURES[d.ordinaryTincture].cls;
  if (fc === oc) {
    const k = fc === 'metal' ? 'Metal on metal' : 'Colour on colour';
    const fix = fc === 'metal' ? 'a colour' : 'a metal (Or or Argent)';
    return `${k} — heralds have frowned on this for 800 years. Try ${fix} for the structure so it reads with contrast.`;
  }
  if (d.charges && d.charges.length) {
    const cc = TINCTURES[d.charges[0].tincture].cls;
    if (cc === fc) {
      const k = fc === 'metal' ? 'Metal on metal' : 'Colour on colour';
      return `${k} — the symbol barely shows against the field. Try the opposite class for it.`;
    }
  }
  return null;
}

// ── The contrast engine (keeps generated/cycled designs tincture-rule valid) ─
export const METALS = ['Or', 'Argent'];
export const COLOURS = ['Gules', 'Azure', 'Vert', 'Purpure', 'Sable'];

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

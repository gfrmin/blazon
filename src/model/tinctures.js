// ─────────────────────────────────────────────────────────────────────────
// Tinctures — the heraldic palette, and the basis of the tincture rule.
//
// Each entry keeps the prototype's { hex, plain, cls } (consumed by Shield,
// blazon(), computeWarn()) so the existing components and the live render are
// unchanged. `cls` is the rule class: 'metal' | 'colour' | 'fur' | 'proper' |
// 'stain'. For the tincture rule, metals and colours oppose; FURS and 'proper'
// (natural colouring) are NEUTRAL (rule-exempt); stains behave as colours.
//
// `formal` is the display spelling when it differs from the key (accents etc.).
// Furs carry { ground, figure } — the metal+colour pair they pattern from — so a
// future renderer can draw the fur and the rule engine knows they're neutral.
// `tier` is the progressive-disclosure depth at which the tincture is offered.
// ─────────────────────────────────────────────────────────────────────────

export const TINCTURES = {
  // ── Metals ──
  Or:      { hex: '#D4AF52', plain: 'gold',   cls: 'metal',  tier: 0 },
  Argent:  { hex: '#E7E1D3', plain: 'silver', cls: 'metal',  tier: 0 },
  // ── Colours ──
  Gules:   { hex: '#9F2C2C', plain: 'red',    cls: 'colour', tier: 0 },
  Azure:   { hex: '#1F4E7A', plain: 'blue',   cls: 'colour', tier: 0 },
  Sable:   { hex: '#15151C', plain: 'black',  cls: 'colour', tier: 0 },
  Vert:    { hex: '#2E5A3E', plain: 'green',  cls: 'colour', tier: 0 },
  Purpure: { hex: '#5A3A6B', plain: 'purple', cls: 'colour', tier: 1 },
  // ── Stains (rare colours; behave as colours for the rule) ──
  Murrey:   { hex: '#6E2A43', plain: 'mulberry',     cls: 'stain', tier: 3 },
  Sanguine: { hex: '#6A1B1B', plain: 'blood red',    cls: 'stain', tier: 3 },
  Tenne:    { hex: '#A65A22', plain: 'tawny orange', cls: 'stain', tier: 3, formal: 'Tenné' },
  // ── Furs (a metal ground patterned with a colour figure; rule-neutral) ──
  Ermine:      { hex: '#E7E1D3', plain: 'ermine',       cls: 'fur', ground: 'Argent', figure: 'Sable',  tier: 2 },
  Ermines:     { hex: '#15151C', plain: 'ermines',      cls: 'fur', ground: 'Sable',  figure: 'Argent', tier: 3 },
  Erminois:    { hex: '#D4AF52', plain: 'erminois',     cls: 'fur', ground: 'Or',     figure: 'Sable',  tier: 3 },
  Pean:        { hex: '#15151C', plain: 'pean',         cls: 'fur', ground: 'Sable',  figure: 'Or',     tier: 3 },
  Vair:        { hex: '#1F4E7A', plain: 'vair',         cls: 'fur', ground: 'Argent', figure: 'Azure',  tier: 2 },
  Countervair: { hex: '#1F4E7A', plain: 'counter-vair', cls: 'fur', ground: 'Argent', figure: 'Azure',  tier: 3, formal: 'Counter-vair' },
};

// 'proper' is a tincture-like value meaning "in its natural colours" — rule-exempt.
export const PROPER = 'proper';

// The original prototype palette order (drives the UI swatch row; unchanged).
export const TINCTURE_ORDER = ['Or', 'Argent', 'Gules', 'Azure', 'Sable', 'Vert', 'Purpure'];

// Contrast engine pools (preserved for the hero/Gifter contrast helpers).
export const METALS = ['Or', 'Argent'];
export const COLOURS = ['Gules', 'Azure', 'Vert', 'Purpure', 'Sable'];

export const FURS = Object.keys(TINCTURES).filter((k) => TINCTURES[k].cls === 'fur');
export const STAINS = Object.keys(TINCTURES).filter((k) => TINCTURES[k].cls === 'stain');

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Rule class of a tincture key ('metal'|'colour'|'fur'|'proper'|'stain'), or null. */
export function tinctureClass(key) {
  if (!key) return null;
  if (key === PROPER) return 'proper';
  return TINCTURES[key]?.cls ?? null;
}

/**
 * The class a tincture contributes to the tincture rule: 'metal' or 'colour'.
 * Furs and 'proper' are NEUTRAL → null (they never clash). Stains read as colour.
 */
export function contrastClass(key) {
  const cls = tinctureClass(key);
  if (cls === 'metal') return 'metal';
  if (cls === 'colour' || cls === 'stain') return 'colour';
  return null; // fur | proper | unknown → neutral
}

export const isMetal = (key) => contrastClass(key) === 'metal';
export const isColour = (key) => contrastClass(key) === 'colour';

/** Formal (display) spelling of a tincture. 'proper' stays lower-case by convention. */
export function tinctureFormal(key) {
  if (!key) return '';
  if (key === PROPER) return 'proper';
  return TINCTURES[key]?.formal || key;
}

/** Plain-English colour word. Falls back to a lower-cased key. */
export function tincturePlain(key) {
  if (!key) return '';
  if (key === PROPER) return 'in natural colours';
  return TINCTURES[key]?.plain || key.toLowerCase();
}

/** A render hex for a tincture (furs approximate to their ground until drawn properly). */
export function tinctureHex(key, fallback = '#ECE6D8') {
  if (!key || key === PROPER) return fallback;
  const e = TINCTURES[key];
  if (!e) return fallback;
  if (e.cls === 'fur') return TINCTURES[e.ground]?.hex ?? e.hex ?? fallback;
  return e.hex ?? fallback;
}

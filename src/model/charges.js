// ─────────────────────────────────────────────────────────────────────────
// Charges — the mobile objects on a shield, and their attitudes.
//
// CHARGES keeps the prototype's four geometric charges (mullet/crescent/roundel/
// lozenge — still renderable by Shield.jsx today) and adds a real library schema:
// every charge carries `category`, `validAttitudes`, `defaultAttitude`,
// `validArrangements`, and a disclosure `tier`. The category drives which
// attitudes are valid (a fish can be naiant, never rampant). Art for the
// non-geometric charges is added over time — the SCHEMA is the moat.
// ─────────────────────────────────────────────────────────────────────────

// Attitudes (postures). `for` lists the categories each applies to; `plain` is a
// jargon-free gloss. The rule engine uses `for` to reject invalid combinations.
export const ATTITUDES = {
  rampant:            { plain: 'rearing up',        for: ['beast'], tier: 1 },
  passant:            { plain: 'walking',           for: ['beast'], tier: 1 },
  'passant guardant': { plain: 'walking, facing out', for: ['beast'], tier: 2 },
  statant:            { plain: 'standing',          for: ['beast'], tier: 2 },
  sejant:             { plain: 'sitting',           for: ['beast'], tier: 2 },
  salient:            { plain: 'leaping',           for: ['beast'], tier: 3 },
  couchant:           { plain: 'lying down',        for: ['beast'], tier: 3 },
  dormant:            { plain: 'sleeping',          for: ['beast'], tier: 3 },
  displayed:          { plain: 'wings spread',      for: ['bird'],  tier: 1 },
  rising:             { plain: 'taking flight',     for: ['bird'],  tier: 3 },
  volant:             { plain: 'flying',            for: ['bird'],  tier: 3 },
  naiant:             { plain: 'swimming',          for: ['fish'],  tier: 2 },
  hauriant:           { plain: 'upright',           for: ['fish'],  tier: 3 },
  embowed:            { plain: 'curved',            for: ['fish'],  tier: 3 },
};

const beast = (validAttitudes, def = 'rampant') => ({ category: 'beast', validAttitudes, defaultAttitude: def });
const BEAST_ATTS = ['rampant', 'passant', 'passant guardant', 'statant', 'sejant', 'salient', 'couchant', 'dormant'];

export const CHARGES = {
  // ── Geometric (prototype) — renderable today ──
  mullet:   { label: 'Star',     formal: 'mullet',   formalPl: 'mullets',   plain: 'star',          plainPl: 'stars',         category: 'geometric', tier: 0 },
  crescent: { label: 'Crescent', formal: 'crescent', formalPl: 'crescents', plain: 'crescent moon', plainPl: 'crescent moons', category: 'geometric', tier: 0 },
  roundel:  { label: 'Disc',     formal: 'roundel',  formalPl: 'roundels',  plain: 'disc',          plainPl: 'discs',         category: 'geometric', tier: 0 },
  lozenge:  { label: 'Diamond',  formal: 'lozenge',  formalPl: 'lozenges',  plain: 'diamond',       plainPl: 'diamonds',      category: 'geometric', tier: 0 },

  // ── Beasts (attitudes apply) ──
  lion:   { label: 'Lion',   formal: 'lion',   formalPl: 'lions',   plain: 'lion',   plainPl: 'lions',   ...beast(BEAST_ATTS),                       tier: 1 },
  wolf:   { label: 'Wolf',   formal: 'wolf',   formalPl: 'wolves',  plain: 'wolf',   plainPl: 'wolves',  ...beast(BEAST_ATTS, 'passant'),           tier: 2 },
  bear:   { label: 'Bear',   formal: 'bear',   formalPl: 'bears',   plain: 'bear',   plainPl: 'bears',   ...beast(BEAST_ATTS),                       tier: 2 },
  stag:   { label: 'Stag',   formal: 'stag',   formalPl: 'stags',   plain: 'stag',   plainPl: 'stags',   ...beast(['statant', 'passant', 'salient', 'couchant', 'lodged'], 'statant'), tier: 2 },
  boar:   { label: 'Boar',   formal: 'boar',   formalPl: 'boars',   plain: 'boar',   plainPl: 'boars',   ...beast(BEAST_ATTS, 'passant'),           tier: 3 },
  horse:  { label: 'Horse',  formal: 'horse',  formalPl: 'horses',  plain: 'horse',  plainPl: 'horses',  ...beast(['rampant', 'passant', 'salient', 'courant'], 'rampant'), tier: 3 },
  griffin:{ label: 'Griffin',formal: 'griffin',formalPl: 'griffins',plain: 'griffin',plainPl: 'griffins',...beast(['rampant', 'passant', 'segreant', 'sejant'], 'segreant'), tier: 2 },
  dragon: { label: 'Dragon', formal: 'dragon', formalPl: 'dragons', plain: 'dragon', plainPl: 'dragons', ...beast(['rampant', 'passant', 'sejant', 'displayed'], 'rampant'), tier: 2 },

  // ── Birds ──
  eagle:   { label: 'Eagle',   formal: 'eagle',   formalPl: 'eagles',   plain: 'eagle',   plainPl: 'eagles',   category: 'bird', validAttitudes: ['displayed', 'rising', 'volant'], defaultAttitude: 'displayed', tier: 1 },
  martlet: { label: 'Martlet', formal: 'martlet', formalPl: 'martlets', plain: 'swallow', plainPl: 'swallows', category: 'bird', validAttitudes: ['close', 'volant'], defaultAttitude: 'close', tier: 2 },
  falcon:  { label: 'Falcon',  formal: 'falcon',  formalPl: 'falcons',  plain: 'falcon',  plainPl: 'falcons',  category: 'bird', validAttitudes: ['close', 'rising', 'displayed'], defaultAttitude: 'close', tier: 3 },

  // ── Fish ──
  fish:     { label: 'Fish',    formal: 'fish',    formalPl: 'fish',     plain: 'fish',    plainPl: 'fish',     category: 'fish', validAttitudes: ['naiant', 'hauriant', 'embowed'], defaultAttitude: 'naiant', tier: 2 },
  dolphin:  { label: 'Dolphin', formal: 'dolphin', formalPl: 'dolphins', plain: 'dolphin', plainPl: 'dolphins', category: 'fish', validAttitudes: ['naiant', 'hauriant', 'embowed'], defaultAttitude: 'embowed', tier: 3 },

  // ── Objects & flora (no attitude) ──
  fleurdelys: { label: 'Fleur-de-lys', formal: 'fleur-de-lys', formalPl: 'fleurs-de-lys', plain: 'lily', plainPl: 'lilies', category: 'object', tier: 1 },
  escallop:   { label: 'Scallop',      formal: 'escallop',     formalPl: 'escallops',     plain: 'scallop shell', plainPl: 'scallop shells', category: 'object', tier: 2 },
  anchor:     { label: 'Anchor',       formal: 'anchor',       formalPl: 'anchors',       plain: 'anchor',  plainPl: 'anchors',  category: 'object', tier: 1 },
  tower:      { label: 'Tower',        formal: 'tower',        formalPl: 'towers',        plain: 'tower',   plainPl: 'towers',   category: 'object', tier: 2 },
  sword:      { label: 'Sword',        formal: 'sword',        formalPl: 'swords',        plain: 'sword',   plainPl: 'swords',   category: 'object', tier: 2 },
  key:        { label: 'Key',          formal: 'key',          formalPl: 'keys',          plain: 'key',     plainPl: 'keys',     category: 'object', tier: 2 },
  rose:       { label: 'Rose',         formal: 'rose',         formalPl: 'roses',         plain: 'rose',    plainPl: 'roses',    category: 'flora',  tier: 1 },
  oakleaf:    { label: 'Oak leaf',     formal: 'oak leaf',     formalPl: 'oak leaves',    plain: 'oak leaf', plainPl: 'oak leaves', category: 'flora', tier: 3 },
};
// Prototype order — drives the symbol cycler / chips; unchanged.
export const CHARGE_ORDER = ['mullet', 'crescent', 'roundel', 'lozenge'];

export const isCharge = (key) => Object.prototype.hasOwnProperty.call(CHARGES, key);
export const categoryOf = (key) => CHARGES[key]?.category ?? null;
export const validAttitudesFor = (key) => CHARGES[key]?.validAttitudes ?? [];
export const defaultAttitudeFor = (key) => CHARGES[key]?.defaultAttitude ?? null;

/** Is `attitude` valid for the charge `key`? (true when the charge takes no attitude.) */
export function attitudeValid(key, attitude) {
  if (!attitude) return true;
  const valid = validAttitudesFor(key);
  if (!valid.length) return false; // an object/geometric charge has no attitude
  return valid.includes(attitude);
}

// Charges outside the curated CHARGES table (the wider R2 catalog) have no
// formal/plain forms — humanise the key (drop hyphens) as a reasonable blazon noun.
const humanizeKey = (key) => key.replace(/[-_]/g, ' ').trim();

// A few irregular plurals common to heraldic charge names. Most charges follow
// the regular rules below; this table covers the ones those would get wrong.
const IRREGULAR_PL = {
  leaf: 'leaves', wolf: 'wolves', calf: 'calves', sheaf: 'sheaves', staff: 'staves',
  knife: 'knives', man: 'men', woman: 'women', foot: 'feet', tooth: 'teeth',
  goose: 'geese', mouse: 'mice', ox: 'oxen', child: 'children', fish: 'fish',
  deer: 'deer', sheep: 'sheep',
};

/** Pluralise a single English word with regular rules + a small irregular table. */
function pluralWord(w) {
  if (!w) return w;
  const lower = w.toLowerCase();
  if (IRREGULAR_PL[lower]) return IRREGULAR_PL[lower];
  if (/(?:s|x|z|ch|sh)$/.test(lower)) return w + 'es';
  if (/[^aeiou]y$/.test(lower)) return w.slice(0, -1) + 'ies';
  if (/[^aeiou]o$/.test(lower)) return w + 'es'; // tomato-style; rare in charges
  return w + 's';
}

// Heraldic charge names are often compounds joined by connectors ("sun in
// splendour", "fleur de lys", "cross of Lorraine"). The plural inflects the HEAD
// noun (before the connector), not the trailing word. With no connector, the last
// word is the head ("oak tree" → "oak trees").
const CONNECTORS = new Set(['in', 'of', 'de', 'and', 'a', 'la', 'le', 'sur', 'the', 'within', 'between', 'upon', 'over', 'du', 'des']);
function pluralizeTerm(term) {
  const words = term.split(/\s+/);
  if (words.length === 1) return pluralWord(words[0]);
  const ci = words.findIndex((w) => CONNECTORS.has(w.toLowerCase()));
  const head = ci > 0 ? ci - 1 : words.length - 1; // word before the first connector, else the last
  return words.map((w, i) => (i === head ? pluralWord(w) : w)).join(' ');
}

const catalogNoun = (key, plural) => {
  const n = humanizeKey(key);
  return plural ? pluralizeTerm(n) : n;
};

/** The blazon noun for a charge, singular or plural. */
export function chargeNoun(key, plural = false) {
  const c = CHARGES[key];
  if (!c) return catalogNoun(key, plural);
  return plural ? c.formalPl : c.formal;
}
export function chargePlain(key, plural = false) {
  const c = CHARGES[key];
  if (!c) return catalogNoun(key, plural);
  return plural ? c.plainPl : c.plain;
}

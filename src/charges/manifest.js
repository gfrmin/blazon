import catalog from './catalog.js';

// The full vendored charge library: { catalogKey: "category/name" } for ~2,200
// GPL/CC-BY-SA charges hosted on R2. catalogKey is the DrawShield filename slug.
export const CATALOG = catalog;
export const catalogKeys = Object.keys(catalog);

// Curated charges whose blazon is attitude-aware (nice grammar + posture pills in
// the builder). Values are CATALOG keys; an attitude picks the right art file.
export const CHARGE_ART = {
  lion: {
    default: 'lion-rampant',
    byAttitude: {
      rampant: 'lion-rampant', passant: 'lion-passant', 'passant guardant': 'lion-passant-guardant',
      statant: 'lion-statant', sejant: 'lion-sejant', salient: 'lion-salient',
      couchant: 'lion-couchant', dormant: 'lion-dormant',
    },
  },
  bear: {
    default: 'bear-rampant',
    byAttitude: {
      rampant: 'bear-rampant', passant: 'bear-passant', 'passant guardant': 'bear-passant-guardant',
      sejant: 'bear-sejant', couchant: 'bear-couchant', dormant: 'bear-dormant',
    },
  },
  wolf: { default: 'wolf' },
  stag: { default: 'stag' },
  boar: { default: 'boar' },
  horse: { default: 'horse' },
  griffin: { default: 'griffin' },
  dragon: { default: 'dragon' },
  eagle: { default: 'eagle' },
  falcon: { default: 'falcon' },
  martlet: { default: 'martlett', byAttitude: { close: 'martlett', volant: 'martlett-volant' } },
  fish: { default: 'fish' },
  dolphin: { default: 'dolphin' },
  fleurdelys: { default: 'fleur-de-lys' },
  rose: { default: 'rose' },
  escallop: { default: 'escallop' },
  anchor: { default: 'anchor' },
  tower: { default: 'tower' },
  sword: { default: 'arming-sword' },
  key: { default: 'key' },
};

/**
 * Resolve a charge key (a model key like 'lion'/'fleurdelys', optionally with an
 * attitude, OR a raw catalog key like 'sun-in-splendour') → its R2 path, or null.
 */
export function artFile(key, attitude) {
  const c = CHARGE_ART[key];
  const catKey = c ? ((attitude && c.byAttitude && c.byAttitude[attitude]) || c.default) : key;
  return catalog[catKey] || null;
}

export const hasArt = (key, attitude) => !!artFile(key, attitude);

export const humanize = (k) => k.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Picker metadata for a catalog key. */
export function catalogEntry(catKey) {
  const path = catalog[catKey];
  if (!path) return null;
  return { key: catKey, path, category: path.split('/')[0], label: humanize(catKey) };
}

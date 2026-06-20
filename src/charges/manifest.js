// Maps our semantic charge key (+ attitude) → the vendored SVG basename served
// from /charges/. Single source for which art renders and (with attribution.json)
// who to credit. Charges absent here fall back to DrawShield until vendored.
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

export const hasArt = (key) => Object.prototype.hasOwnProperty.call(CHARGE_ART, key);

/** Vendored SVG basename for a charge key (+ optional attitude), or null. */
export function artFile(key, attitude) {
  const e = CHARGE_ART[key];
  if (!e) return null;
  return (attitude && e.byAttitude && e.byAttitude[attitude]) || e.default;
}

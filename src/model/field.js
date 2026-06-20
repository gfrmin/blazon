// ─────────────────────────────────────────────────────────────────────────
// Field — divisions of the shield, lines of partition, and field treatments.
//
// A field is either a single tincture or DIVIDED (party per X) or VARIED with a
// repeating pattern (paly, barry, chequy…). Divisions and ordinaries can take a
// LINE of partition (wavy, engrailed…). `tier` is the progressive-disclosure
// depth at which the option is surfaced.
// ─────────────────────────────────────────────────────────────────────────

// Lines of partition — the edge style of a division line or an ordinary.
// `plain` is a jargon-free gloss for Tier-0/1 surfaces.
export const LINES = {
  straight:   { plain: 'straight',              tier: 0 },
  engrailed:  { plain: 'scalloped (points out)', tier: 2 },
  invected:   { plain: 'scalloped (points in)',  tier: 3 },
  embattled:  { plain: 'battlement-edged',       tier: 2 },
  indented:   { plain: 'zigzag',                 tier: 2 },
  dancetty:   { plain: 'deep zigzag',            tier: 3 },
  wavy:       { plain: 'wavy',                   tier: 1 },
  nebuly:     { plain: 'cloud-edged',            tier: 3 },
  raguly:     { plain: 'ragged',                 tier: 3 },
  dovetailed: { plain: 'dovetailed',             tier: 3 },
  potenty:    { plain: 'T-shaped',               tier: 3 },
};
export const LINE_ORDER = Object.keys(LINES);

// Field divisions. `parts` = how many tinctures the division names.
// `repeat: true` marks a repeating pattern that may take a piece count.
export const DIVISIONS = {
  'per pale':          { parts: 2, plain: 'split down the middle',      tier: 1 },
  'per fess':          { parts: 2, plain: 'split across the middle',    tier: 1 },
  'per bend':          { parts: 2, plain: 'split diagonally',           tier: 2 },
  'per bend sinister': { parts: 2, plain: 'split the other diagonal',   tier: 3 },
  'per chevron':       { parts: 2, plain: 'split by a chevron line',    tier: 2 },
  'per saltire':       { parts: 2, plain: 'split into four by an X',    tier: 2 },
  quarterly:           { parts: 2, plain: 'quartered',                  tier: 1 },
  paly:                { parts: 2, repeat: true, plain: 'vertical stripes',   tier: 2 },
  barry:               { parts: 2, repeat: true, plain: 'horizontal stripes', tier: 2 },
  bendy:               { parts: 2, repeat: true, plain: 'diagonal stripes',   tier: 2 },
  chequy:              { parts: 2, repeat: true, plain: 'checkered',          tier: 2 },
  lozengy:             { parts: 2, repeat: true, plain: 'diamond pattern',    tier: 3 },
  gyronny:             { parts: 2, repeat: true, plain: 'pinwheel of triangles', tier: 3 },
};
export const DIVISION_ORDER = Object.keys(DIVISIONS);

// Field treatments (semy = strewn with small charges, etc.). Kept light for now.
export const TREATMENTS = {
  semy:    { plain: 'strewn with',  tier: 3 },
  fretty:  { plain: 'latticed',     tier: 3 },
  masoned: { plain: 'masonry-lined', tier: 3 },
};

export const isDivision = (type) => Object.prototype.hasOwnProperty.call(DIVISIONS, type);
export const isRepeatingDivision = (type) => !!DIVISIONS[type]?.repeat;

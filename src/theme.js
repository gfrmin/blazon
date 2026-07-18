// ─────────────────────────────────────────────────────────────────────────
// Design tokens — the single home for the app's visual language.
//
// The app is styled with inline style objects (the palette is built from
// heraldic tinctures). Before this module those tokens were re-inlined across
// Landing/Studio/ui, which is how the £→$ drift went unnoticed. Everything
// shared now lives here: colours, fonts, and a few reusable style fragments.
// Aesthetic: "digital illuminated manuscript" — navy + gold, parchment accents.
// ─────────────────────────────────────────────────────────────────────────

// Surfaces & ink (dark base)
export const C = {
  bg: '#090C13',
  bg2: '#0F1826',
  panel: '#101A2A',
  panel2: '#16273E',
  ink: '#0B111C', // builder card background
  line: 'rgba(201,162,75,.16)',
  lineMid: 'rgba(201,162,75,.22)',
  lineHi: 'rgba(201,162,75,.42)',
  gold: '#C9A24B',
  goldBr: '#DCBB66',
  goldDp: '#A8842F',
  goldInk: '#1A1206', // text on a gold button
  cream: '#ECE6D8',
  muted: 'rgba(236,230,216,.66)',
  muted2: 'rgba(236,230,216,.46)',
  // For SMALL text (≤ ~14px): muted2 composites to ~3.9:1 on bg2 — fine for
  // large type, below WCAG AA's 4.5:1 for small labels. This blends to ~5:1
  // on bg/bg2. Use it wherever muted2 text renders under ~15px.
  label: 'rgba(236,230,216,.58)',
  // Parchment accent (gallery / gift / certificate — evokes the print product)
  parch: '#ECE3CB',
  parchEdge: '#D8CCAB',
  parchInk: '#2C2718',
  parchInk2: '#6A5F44',
  parchRule: 'rgba(120,100,60,.34)',
};

// Type system — Cormorant (display) · Inter (UI) · Spline Mono (blazon).
export const F = {
  serif: "'Cormorant Garamond', serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "'Spline Sans Mono', monospace",
};

// Faint atmospheric wash used on full-page dark backgrounds.
export const pageWash =
  'radial-gradient(1100px 560px at 82% -6%, rgba(201,162,75,.11), transparent 58%),' +
  'radial-gradient(820px 640px at 4% 10%, rgba(31,78,122,.20), transparent 60%)';

// The gilded primary button surface (used for every gold CTA).
export const goldBtn = {
  background: `linear-gradient(180deg, ${C.goldBr}, ${C.gold})`,
  color: C.goldInk,
  border: 'none',
  borderRadius: 7,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: F.sans,
  boxShadow: '0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px rgba(168,132,47,.26)',
  transition: 'transform .15s, box-shadow .15s',
};
export const goldBtnHover = {
  transform: 'translateY(-1px)',
  boxShadow: '0 1px 0 rgba(255,255,255,.3) inset, 0 12px 28px rgba(168,132,47,.4)',
};

// Small uppercase gold eyebrow label.
export const eyebrow = {
  fontSize: 11.5,
  letterSpacing: '4px',
  color: C.gold,
  fontWeight: 600,
  textTransform: 'uppercase',
};

// Parchment surface (light vellum) with a faint laid-paper texture.
export const parchSurface = {
  background: C.parch,
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(120,100,60,.05) 0 2px, transparent 2px 7px)',
  boxShadow: '0 16px 40px rgba(0,0,0,.45)',
  border: `1px solid ${C.parchEdge}`,
};

// A dark builder card (Studio).
export const card = {
  background: C.ink,
  border: `1px solid ${C.lineMid}`,
  borderRadius: 12,
  padding: 18,
};

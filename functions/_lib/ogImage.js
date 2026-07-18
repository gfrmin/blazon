// Shared og:image canvas dimensions — the ONE place both OG Functions read
// from, so functions/a/[payload].js's injected og:image:width/height meta
// tags can never drift from what functions/api/og/[payload].js actually
// rasterises.
//
// The achievement's own canvas (src/achievement-art/layout.js's
// LAYOUT.viewBox) is a 1000×1200 portrait. A padded 1200×1200 square keeps
// the achievement at its full native scale (only left/right letterboxing,
// 100px each side) rather than shrinking it to fit a 1200×630 landscape crop
// (which would leave only ~525×630 of actual achievement — the brief flags
// this as a legitimate pick between the two; a bigger, more legible shield
// wins here since making the ACTUAL coat of arms visible in the unfurled
// preview is the whole point of this task — the viral hook).
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 1200;

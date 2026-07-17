// ─────────────────────────────────────────────────────────────────────────
// Thin re-export — the implementation moved to src/achievementArt.js
// (task-19) so the browser export path (src/export.js) and this Worker's
// og:image Function (functions/api/og/[payload].js) share ONE broadened
// implementation (the Task 17 residual: resolve ALL mobile shield charge
// groups, not just the first — see src/achievementArt.js's header) instead
// of two copies that can silently drift apart. This file exists only so
// callers that already import '../../_lib/achievementArt.js' (this
// Function + its test, functions/api/og/__tests__/payload.test.js) keep
// working unchanged.
// ─────────────────────────────────────────────────────────────────────────
export { resolveAchievementArt } from '../../src/achievementArt.js';

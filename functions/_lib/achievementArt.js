// ─────────────────────────────────────────────────────────────────────────
// Thin re-export — the implementation moved to src/achievementArt.js
// (task-19) so the browser export path (src/export.js) and this Worker's
// og:image Function (functions/api/og/[payload].js) share ONE implementation
// instead of two copies that can silently drift apart (see that file's
// header for its own history — briefly broadened to resolve every mobile
// shield-charge group, then re-narrowed by SEC-2, final whole-branch review,
// once that broadening turned out to be an abuse vector). This file exists
// only so callers that already import '../../_lib/achievementArt.js' (this
// Function + its test, functions/api/og/__tests__/payload.test.js) keep
// working unchanged.
// ─────────────────────────────────────────────────────────────────────────
export { resolveAchievementArt } from '../../src/achievementArt.js';

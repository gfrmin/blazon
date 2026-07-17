// ─────────────────────────────────────────────────────────────────────────
// Analytics — minimal stub (task-6 brief §3). A later task swaps the
// internals for PostHog; call-sites land now so the funnel is instrumented
// from day one instead of being bolted on retroactively.
// ─────────────────────────────────────────────────────────────────────────

/** Fire-and-forget event tracking. No-op in production until PostHog lands;
 *  logs to the console in dev so instrumentation is visible while building. */
export function track(name, props = {}) {
  if (import.meta.env.DEV) console.debug('[track]', name, props);
}

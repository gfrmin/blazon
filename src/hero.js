// ─────────────────────────────────────────────────────────────────────────
// Pure `/studio?desc=` link builder (task-20 brief §3) — the hero inline
// describe input submits straight into Studio's existing `?desc=` arrival
// path (Task 4/15: Studio's mount effect reads `?desc=`, prefills the
// describe step, and queues auto-generation — see Studio.jsx's
// `autoGenPending` effect), so generation is already in flight the instant
// the visitor lands. Kept separate/pure so the encoding itself is
// node-testable without a DOM (mirrors src/share/link.js's `shareUrl`).
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {string} desc  free-text description, as typed into the hero input
 * @returns {string}  a same-origin relative path, e.g. "/studio?desc=..."
 */
export function heroStudioUrl(desc) {
  return `/studio?desc=${encodeURIComponent(String(desc ?? '').trim())}`;
}

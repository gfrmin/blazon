// ─────────────────────────────────────────────────────────────────────────
// Pure /a/<payload> absolute-URL builder (Task 18, SharePopover + LibraryCard
// + the /a/ presentation view all need "origin + /a/ + payload" and nothing
// more). Kept separate from encodeCoat/decodeCoat (./codec.js) so it's
// testable as a plain string join, no async compression/hashing involved.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {string} origin  e.g. `window.location.origin`
 * @param {string} payload  an encodeCoat() payload
 * @returns {string}
 */
export function shareUrl(origin, payload) {
  return `${String(origin).replace(/\/+$/, '')}/a/${payload}`;
}

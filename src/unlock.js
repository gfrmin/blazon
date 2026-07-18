// ─────────────────────────────────────────────────────────────────────────
// Client unlock store — localStorage['blazon:unlocks'] =
// { [designHash]: { token, envelope, unlockedAt } }.
//
// `envelope` ({v:1, coat}, the SAME shape src/share/codec.js encodes/decodes
// and src/library.js stores) is a FROZEN SNAPSHOT of the design exactly as
// it was at the moment of purchase — captured once by `recordUnlock` and
// never re-derived from `hash` afterwards, so a LATER edit to the live
// working design (which changes ITS OWN designHash) can never overwrite or
// invalidate this entry. This is what makes the task-19 brief's "honesty
// rule" true: unlocking is per-EXACT-design (by hash) — editing after
// unlocking makes the paid button reappear for the new hash, but the
// originally-purchased file stays downloadable forever via
// `getUnlockedSnapshot(theOriginalHash)`.
//
// Pure ops over an injected `storage` (default `localStorage`), same
// defensive posture as src/library.js: every read/write try/catches and
// never throws; corrupt/missing storage reads as "nothing unlocked".
//
// CROSS-MODULE CONTRACT: src/analytics.js's `_computeInitialSuperProps`
// already reads this EXACT key (`blazon:unlocks`) via a plain
// `getItem(...) != null` presence check to compute the `has_purchased`
// super-prop — the storage key name below is not incidental.
// ─────────────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'blazon:unlocks';

// sessionStorage marker set by DownloadDialog right before redirecting to
// Stripe Checkout, read (and cleared) by Studio's `?cs=` return-leg effect —
// the ONLY way to tell "came back via Stripe's cancel_url" apart from "any
// other /studio visit" (task-19 brief §2's cancel_url carries no query
// marker of its own). Lives here (not duplicated as a literal in both
// files) so the two call-sites can never drift apart.
export const CHECKOUT_PENDING_KEY = 'blazon:checkout_pending';

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    // Some sandboxed contexts throw on merely ACCESSING localStorage.
    return undefined;
  }
}

function readAll(storage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(storage, all) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/**
 * Is `hash` currently unlocked?
 * @param {string} hash
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function isUnlocked(hash, storage = defaultStorage()) {
  if (!hash) return false;
  return !!readAll(storage)[hash];
}

/**
 * Record a purchase. `envelope` ({v:1, coat}) is captured as a FROZEN
 * snapshot — see file header. Returns true on a successful write, false on
 * storage failure (never throws).
 * @param {string} hash
 * @param {string} token
 * @param {{v: 1, coat: object}} envelope
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function recordUnlock(hash, token, envelope, storage = defaultStorage()) {
  if (!hash || !token || !envelope) return false;
  const all = readAll(storage);
  all[hash] = { token, envelope, unlockedAt: Date.now() };
  return writeAll(storage, all);
}

/**
 * The frozen `{ token, envelope, unlockedAt }` record for `hash`, or `null`.
 * @param {string} hash
 * @param {Storage} [storage]
 * @returns {{token: string, envelope: {v:1, coat: object}, unlockedAt: number} | null}
 */
export function getUnlockedSnapshot(hash, storage = defaultStorage()) {
  if (!hash) return null;
  return readAll(storage)[hash] || null;
}

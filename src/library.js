// ─────────────────────────────────────────────────────────────────────────
// Library — the localStorage-backed "my saved designs" data layer (M3/B5,
// task-16 brief §1). Pure functions over an INJECTED storage object (default
// `localStorage`; tests pass a Map-backed stub — no real localStorage under
// `node --test`). This module owns reads/writes of `blazon:library:v1` and
// nothing else: no React, no UI, no analytics call-sites (Studio.jsx wires
// Save → these ops and fires `design_saved` itself). The `/library` grid and
// the recipient `/a/` view are a later task (M3/C6) — this just exposes a
// clean op surface for it to consume.
//
// Entry shape: { id, name, envelope: {v:1, coat}, createdAt, updatedAt,
// unlocked? }. `envelope` is exactly the shape `src/share/codec.js` encodes/
// decodes, so an entry's design can be handed straight to `encodeCoat()` to
// mint a share link. No stored thumbnails — `<Achievement>`/`<Shield>`
// render live from the AST; a cached thumbnail would go stale the moment the
// entry's coat is edited and re-saved.
//
// Defensive posture: every READ JSON-parses in try/catch and treats
// corrupt/missing storage (or a `storage.getItem` that itself throws) as an
// empty library — this module never throws for a caller to catch. Every
// WRITE try/catches too (quota errors, a storage that throws on `setItem`,
// …) and reports failure via a falsy return value (`null`/`false`), never a
// throw — callers (Studio's Save button) can show a quiet failure state
// without a try/catch of their own. `normalize()` runs on every entry's coat
// on read (not just at save time) so a hand-edited or legacy-shaped stored
// coat is always safe to hand to <Achievement>/<Shield>; an entry whose coat
// can't be normalized at all is dropped from `listDesigns()`/`getDesign()`
// rather than surfacing a broken record.
// ─────────────────────────────────────────────────────────────────────────

import { normalize } from './model/achievement.js';

/** @typedef {{v: 1, coat: import('./model/types.js').Coat}} Envelope */
/**
 * @typedef {Object} LibraryEntry
 * @property {string} id
 * @property {string} name
 * @property {Envelope} envelope
 * @property {number} createdAt - epoch ms
 * @property {number} updatedAt - epoch ms
 * @property {boolean} [unlocked] - set by M4's unlock flow; absent until then
 */

export const STORAGE_KEY = 'blazon:library:v1';

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    // Some sandboxed contexts (e.g. a storage-disabled iframe) throw on
    // merely ACCESSING localStorage, not just on read/write — caught here so
    // module import alone never crashes.
    return undefined;
  }
}

// Raw (un-normalized) entries array, or [] for missing/corrupt/inaccessible
// storage. Never throws.
function readEntries(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Writes the full entries array back; true on success, false on any failure
// (quota exceeded, storage missing/throws, …). Never throws.
function writeEntries(storage, entries) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

// The read-time normalize pass (module header). Returns null (drop) when the
// entry itself is malformed or its coat can't be normalized at all.
function withNormalizedCoat(entry) {
  if (!entry || typeof entry !== 'object' || !entry.envelope) return null;
  const coat = normalize(entry.envelope.coat);
  if (!coat) return null;
  return { ...entry, envelope: { v: 1, coat } };
}

/**
 * Every saved design, most-recently-updated first. Corrupt/missing storage,
 * or any individual entry that can't be normalized, is silently excluded —
 * this never throws.
 * @param {Storage} [storage]
 * @returns {LibraryEntry[]}
 */
export function listDesigns(storage = defaultStorage()) {
  return readEntries(storage)
    .map(withNormalizedCoat)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * A single saved design by id, or `null` if missing/corrupt.
 * @param {Storage} storage
 * @param {string} id
 * @returns {LibraryEntry | null}
 */
export function getDesign(storage = defaultStorage(), id) {
  return listDesigns(storage).find((e) => e.id === id) || null;
}

/**
 * Upsert a design. No `id` → creates a new entry (fresh `crypto.randomUUID()`
 * id). An `id` that matches an existing entry → overwrites it in place
 * (keeps `createdAt`, bumps `updatedAt`, keeps the existing `name` unless a
 * new one is given). An `id` that does NOT match any existing entry creates
 * a new entry under that given id (upsert, not "must already exist") —
 * lets a caller that already knows the id it wants (e.g. re-saving after a
 * library that was cleared out from under it) not silently fork into a
 * second id.
 *
 * Returns the saved entry on success, or `null` if the coat couldn't be
 * normalized (nothing valid to store) or the write itself failed (e.g.
 * storage quota) — never throws.
 * @param {Storage} storage
 * @param {{id?: string, name?: string, coat: object}} args
 * @returns {LibraryEntry | null}
 */
export function saveDesign(storage = defaultStorage(), { id, name, coat } = {}) {
  const normalizedCoat = normalize(coat);
  if (!normalizedCoat) return null;

  const entries = readEntries(storage);
  const idx = id ? entries.findIndex((e) => e && e.id === id) : -1;
  const now = Date.now();
  const envelope = { v: 1, coat: normalizedCoat };

  let entry;
  let next;
  if (idx !== -1) {
    entry = { ...entries[idx], name: name ?? entries[idx].name, envelope, updatedAt: now };
    next = entries.map((e, i) => (i === idx ? entry : e));
  } else {
    entry = { id: id || crypto.randomUUID(), name: name || 'Untitled', envelope, createdAt: now, updatedAt: now };
    next = [...entries, entry];
  }

  return writeEntries(storage, next) ? withNormalizedCoat(entry) : null;
}

/**
 * Rename an existing entry (bumps `updatedAt`). Returns the updated entry,
 * or `null` if the id doesn't exist or the write failed — never throws, never
 * creates an entry.
 * @param {Storage} storage
 * @param {string} id
 * @param {string} name
 * @returns {LibraryEntry | null}
 */
export function renameDesign(storage = defaultStorage(), id, name) {
  const entries = readEntries(storage);
  const idx = entries.findIndex((e) => e && e.id === id);
  if (idx === -1) return null;

  const entry = { ...entries[idx], name, updatedAt: Date.now() };
  const next = entries.map((e, i) => (i === idx ? entry : e));
  return writeEntries(storage, next) ? withNormalizedCoat(entry) : null;
}

/**
 * Delete an entry. Returns `true` if an entry was removed, `false` if the id
 * didn't exist (a no-op — storage isn't even re-written) or the write failed.
 * @param {Storage} storage
 * @param {string} id
 * @returns {boolean}
 */
export function deleteDesign(storage = defaultStorage(), id) {
  const entries = readEntries(storage);
  const next = entries.filter((e) => !(e && e.id === id));
  if (next.length === entries.length) return false; // missing id — no-op
  return writeEntries(storage, next);
}

/**
 * Set/clear the `unlocked` flag on an entry (M4's paid-unlock flow bumps
 * this). Bumps `updatedAt` like any other mutation. Returns the updated
 * entry, or `null` if the id doesn't exist or the write failed.
 * @param {Storage} storage
 * @param {string} id
 * @param {boolean} unlocked
 * @returns {LibraryEntry | null}
 */
export function setUnlocked(storage = defaultStorage(), id, unlocked) {
  const entries = readEntries(storage);
  const idx = entries.findIndex((e) => e && e.id === id);
  if (idx === -1) return null;

  const entry = { ...entries[idx], unlocked: !!unlocked, updatedAt: Date.now() };
  const next = entries.map((e, i) => (i === idx ? entry : e));
  return writeEntries(storage, next) ? withNormalizedCoat(entry) : null;
}

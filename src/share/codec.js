// ─────────────────────────────────────────────────────────────────────────
// Share codec — permalink payload encode/decode + design hash.
//
// Envelope: { v: 1, coat }. Encoded as deflate-raw (CompressionStream) →
// base64url, prefixed 'c'. Falls back to plain JSON → base64url prefixed 'j'
// when CompressionStream is unavailable. Runs identically in the browser,
// Cloudflare Workers, and Node ≥18 — Web APIs only (CompressionStream,
// DecompressionStream, crypto.subtle, TextEncoder/Decoder, btoa/atob). No
// Buffer, no DOM, no Node-only imports.
// ─────────────────────────────────────────────────────────────────────────

import { normalize } from '../model/achievement.js';

const MAX_LEN = 2000;

// ── base64url over Uint8Array (hand-rolled: no Buffer) ──

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── deflate-raw via CompressionStream/DecompressionStream ──

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ── canonicalization ──

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// A "member" that carries no information: undefined/null, or an empty
// array/object/string. Dropping these makes structurally-equivalent coats
// (e.g. `charges: []` vs. omitted `charges`) canonicalise identically.
function isEmpty(v) {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const out = {};
    const keys = Object.keys(value).filter((k) => k !== 'rationale').sort();
    for (const key of keys) {
      const canon = canonicalize(value[key]);
      if (!isEmpty(canon)) out[key] = canon;
    }
    return out;
  }
  return value;
}

/**
 * A canonical deep copy of a Coat AST for hashing: run through `normalize()`
 * first (so legacy shapes canonicalise identically), keys sorted recursively,
 * `rationale` stripped (display prose, not design), `undefined`/empty members
 * dropped. Any other member — including an `achievement` sub-object, when
 * present — is kept as ordinary nested data.
 * @param {import('../model/types.js').Coat|object} coat
 * @returns {object}
 */
export function canonicalCoat(coat) {
  return canonicalize(normalize(coat));
}

// ── encode / decode ──

async function compress(jsonText) {
  const bytes = new TextEncoder().encode(jsonText);
  if (typeof CompressionStream !== 'undefined') {
    return 'c' + bytesToBase64Url(await deflateRaw(bytes));
  }
  return 'j' + bytesToBase64Url(bytes);
}

/**
 * Encode a Coat AST as a permalink payload: `{v: 1, coat}` → JSON → deflate-raw
 * → base64url, prefixed `c` (or plain JSON → base64url, prefixed `j`, when
 * CompressionStream is unavailable). If the result exceeds 2000 chars, retries
 * with `rationale` stripped from the coat; if still over, returns it anyway.
 * @param {import('../model/types.js').Coat|object} coat
 * @returns {Promise<string>}
 */
export async function encodeCoat(coat) {
  const payload = await compress(JSON.stringify({ v: 1, coat }));
  if (payload.length <= MAX_LEN) return payload;

  const { rationale: _rationale, ...withoutRationale } = coat || {};
  return compress(JSON.stringify({ v: 1, coat: withoutRationale }));
}

/**
 * Decode a permalink payload produced by `encodeCoat` back into a normalized
 * Coat. Throws a plain `Error('bad_payload')` on ANY malformed input (bad
 * base64, bad deflate stream, bad JSON, wrong envelope, unknown prefix).
 * @param {string} payload
 * @returns {Promise<import('../model/types.js').Coat>}
 */
export async function decodeCoat(payload) {
  try {
    if (typeof payload !== 'string' || payload.length === 0) throw new Error('empty');

    const prefix = payload[0];
    const body = payload.slice(1);
    let bytes;
    if (prefix === 'c') {
      bytes = await inflateRaw(base64UrlToBytes(body));
    } else if (prefix === 'j') {
      bytes = base64UrlToBytes(body);
    } else {
      throw new Error('unknown prefix');
    }

    const envelope = JSON.parse(new TextDecoder().decode(bytes));
    if (!isPlainObject(envelope) || envelope.v !== 1 || !isPlainObject(envelope.coat)) {
      throw new Error('bad envelope');
    }

    const coat = normalize(envelope.coat);
    if (!coat) throw new Error('normalize failed');
    return coat;
  } catch {
    throw new Error('bad_payload');
  }
}

/**
 * SHA-256 of the UTF-8 JSON of `canonicalCoat(coat)`, as a lowercase hex string.
 * @param {import('../model/types.js').Coat|object} coat
 * @returns {Promise<string>}
 */
export async function designHash(coat) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalCoat(coat)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

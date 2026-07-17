// ─────────────────────────────────────────────────────────────────────────
// Unlock token — a deterministic, forward-compatible proof that a given
// designHash was paid for. WebCrypto only (Workers-native, no Node crypto,
// matching src/share/codec.js's own house style).
//
// Format: base64url(HMAC-SHA256(secret, 'v1:' + designHash)).
//
// DETERMINISTIC BY DESIGN (not random): /api/verify-payment must be
// idempotent — replaying the SAME Stripe session_id (same metadata.
// designHash) re-mints the IDENTICAL token rather than a fresh one, so no
// separate "already granted" bookkeeping is needed beyond Stripe's own
// session state — sign() is a pure function of (secret, designHash).
//
// FORWARD-COMPATIBLE SEAM (task-19 brief §5): this is client-side-gating
// today (src/unlock.js checks localStorage, not this token, at export time)
// — the token exists so a FUTURE server-side /api/export can validate it
// (`verify()` below) without a client redesign. That endpoint is
// deliberately not built here ("leave that seam clean, don't build it").
// ─────────────────────────────────────────────────────────────────────────

const PREFIX = 'v1:';

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Mint the unlock token for `designHash`, signed with `secret`.
 * @param {string} secret
 * @param {string} designHash
 * @returns {Promise<string>}
 */
export async function sign(secret, designHash) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PREFIX + designHash));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time string compare (equal-length strings only reach here — see
// verify() below): XOR every char code and OR the results together, so the
// number of loop iterations and branches taken never depends on WHERE the
// first mismatch is, only on the (already-known, non-secret) length.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Constant-time verify: does `token` match sign(secret, designHash)?
 * @param {string} secret
 * @param {string} designHash
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function verify(secret, designHash, token) {
  if (typeof token !== 'string' || !token) return false;
  const expected = await sign(secret, designHash);
  return timingSafeEqual(expected, token);
}

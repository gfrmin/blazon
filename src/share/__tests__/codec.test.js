import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canonicalCoat, encodeCoat, decodeCoat, designHash } from '../codec.js';
import { normalize } from '../../model/achievement.js';

// ── fixtures ──

// field (divided) + 2 charge groups + motto + rationale + a nested `achievement`
// member (ad hoc data — not yet in types.js, per the brief).
const sampleCoat = {
  field: { division: { type: 'per pale', tinctures: ['Gules', 'Or'] } },
  charges: [
    { role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'ordinary', key: 'chevron' } },
    { role: 'secondary', number: 3, tincture: 'Azure', object: { kind: 'charge', key: 'mullet' } },
  ],
  motto: 'Fortis et Fidus',
  rationale: { field: 'A divided field of red and gold for valor and wealth.' },
  achievement: {
    crest: { key: 'demi-lion', tincture: 'Or' },
    helm: { type: 'tournament', tier: 3 },
  },
};

// Local base64url helper — deliberately independent of codec.js internals, so the
// "hand-built j payload" test exercises the public contract, not our own helper.
function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── round-trip ──

test('round-trip: encode then decode is deep-equal to the normalized source', async () => {
  const payload = await encodeCoat(sampleCoat);
  const decoded = await decodeCoat(payload);
  assert.deepEqual(decoded, normalize(sampleCoat));
});

test('round-trip: unicode motto (accents + emoji) survives', async () => {
  const coat = { ...sampleCoat, motto: 'Café ☕ – Force et Honneur 🦁' };
  const payload = await encodeCoat(coat);
  const decoded = await decodeCoat(payload);
  assert.equal(decoded.motto, 'Café ☕ – Force et Honneur 🦁');
});

// ── prefix behaviours ──

test('encodeCoat produces a "c"-prefixed payload (CompressionStream available)', async () => {
  const payload = await encodeCoat(sampleCoat);
  assert.equal(payload[0], 'c');
});

test('a hand-built "j" (plain) payload decodes correctly', async () => {
  const envelope = { v: 1, coat: sampleCoat };
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  const payload = 'j' + toBase64Url(bytes);
  const decoded = await decodeCoat(payload);
  assert.deepEqual(decoded, normalize(sampleCoat));
});

// ── tamper / malformed input ──

test('tampered payload (flipped char mid-payload) throws bad_payload', async () => {
  const payload = await encodeCoat(sampleCoat);
  const mid = Math.floor(payload.length / 2);
  const flippedChar = payload[mid] === 'A' ? 'B' : 'A';
  const tampered = payload.slice(0, mid) + flippedChar + payload.slice(mid + 1);
  await assert.rejects(() => decodeCoat(tampered), { message: 'bad_payload' });
});

test('truncated payload throws bad_payload', async () => {
  const payload = await encodeCoat(sampleCoat);
  const truncated = payload.slice(0, payload.length - 5);
  await assert.rejects(() => decodeCoat(truncated), { message: 'bad_payload' });
});

test('empty string throws bad_payload', async () => {
  await assert.rejects(() => decodeCoat(''), { message: 'bad_payload' });
});

test('garbage input throws bad_payload', async () => {
  await assert.rejects(() => decodeCoat('!!not-a-real-payload!!'), { message: 'bad_payload' });
});

// ── SEC-1 (final whole-branch review): decompression-bomb cap ──

test('SEC-1: a highly-compressible, hand-crafted oversized payload throws bad_payload (not OOM, not success) — the INFLATED size is capped, not just the encoded one', async () => {
  // A run of one repeated byte compresses to almost nothing via deflate, but
  // inflates back to its full size — a classic decompression-bomb shape.
  // `encodeCoat` itself couldn't produce a payload this large (it caps the
  // ENCODED length, retrying with rationale stripped) — this hand-builds the
  // 'c'-prefixed wire format directly, exactly what an attacker controlling
  // a `/a/`/`/api/og`/`/api/checkout` URL could send with no encoder involved.
  const huge = JSON.stringify({ v: 1, coat: { field: { tincture: 'Gules' }, charges: [], rationale: 'A'.repeat(5_000_000) } });
  const bytes = new TextEncoder().encode(huge);
  const compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer());
  const payload = 'c' + toBase64Url(compressed);

  // Sanity: the COMPRESSED payload is tiny compared to the 5MB it inflates to
  // (deflate crushes a run of one repeated byte by ~1000×) — proves this is
  // actually testing the decompression-bomb shape (a small wire payload, a
  // huge inflated one), not just an already-huge wire payload that a naive
  // encoded-length check would already have caught.
  assert.ok(payload.length < 20_000, `expected a highly-compressible payload, got ${payload.length} chars`);

  await assert.rejects(() => decodeCoat(payload), { message: 'bad_payload' });
});

test('SEC-1: normal round-trip payloads are comfortably under the inflated-size cap (no false positives)', async () => {
  const payload = await encodeCoat(sampleCoat);
  const decoded = await decodeCoat(payload);
  assert.deepEqual(decoded, normalize(sampleCoat));
});

// ── size guard ──

test('typical coat payload is comfortably under 900 chars', async () => {
  const payload = await encodeCoat(sampleCoat);
  assert.ok(payload.length < 900, `payload length was ${payload.length}`);
});

test('a coat exceeding 2000 chars has its rationale dropped by the size guard', async () => {
  // High-entropy blob (random bytes hex-encoded) so it resists deflate and reliably
  // pushes the encoded payload over 2000 chars.
  const randomBytes = new Uint8Array(3000);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const giant = { ...sampleCoat, rationale: { blob: hex } };

  const payload = await encodeCoat(giant);
  assert.ok(payload.length <= 2000, `payload length was ${payload.length}`);

  const decoded = await decodeCoat(payload);
  assert.equal(decoded.rationale, undefined);
});

// ── designHash ──

test('designHash is stable under key-order permutation of an equivalent coat', async () => {
  const a = {
    field: { division: { type: 'per pale', tinctures: ['Gules', 'Or'] } },
    charges: sampleCoat.charges,
    motto: 'Fortis et Fidus',
  };
  const b = {
    motto: 'Fortis et Fidus',
    charges: sampleCoat.charges,
    field: { division: { type: 'per pale', tinctures: ['Gules', 'Or'] } },
  };
  assert.equal(await designHash(a), await designHash(b));
});

test('designHash is unchanged when only rationale differs', async () => {
  const a = { ...sampleCoat, rationale: { field: 'Red and gold for valor.' } };
  const b = { ...sampleCoat, rationale: { field: 'Totally different prose.' } };
  assert.equal(await designHash(a), await designHash(b));
});

test('designHash changes when a tincture changes', async () => {
  const a = sampleCoat;
  const b = { ...sampleCoat, charges: [
    { role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'ordinary', key: 'chevron' } },
    { role: 'secondary', number: 3, tincture: 'Gules', object: { kind: 'charge', key: 'mullet' } }, // Azure → Gules
  ] };
  assert.notEqual(await designHash(a), await designHash(b));
});

test('designHash changes when an achievement sub-value changes', async () => {
  const a = sampleCoat;
  const b = {
    ...sampleCoat,
    achievement: { ...sampleCoat.achievement, crest: { key: 'demi-lion', tincture: 'Argent' } },
  };
  assert.notEqual(await designHash(a), await designHash(b));
});

test('designHash returns a lowercase 64-char hex string', async () => {
  const hash = await designHash(sampleCoat);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

// ── canonicalCoat ──

test('canonicalCoat strips rationale and normalizes legacy shapes', () => {
  const legacy = {
    field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or',
    charges: [{ type: 'mullet', tincture: 'Argent', qty: 3 }],
    rationale: 'legacy rationale prose',
  };
  const canon = canonicalCoat(legacy);
  assert.equal(canon.rationale, undefined);
  assert.equal(canon.field.tincture, 'Gules');
});

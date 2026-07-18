import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAchievementArt } from '../achievementArt.js';
import { R2_BASE, artKey } from '../charges/recolor.js';
import { artFile } from '../charges/manifest.js';
import { withDefaultAchievement, tinctureHex } from '../heraldry.js';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

// A trivial, valid charge SVG (matches functions/api/og/__tests__/payload.test.js's
// own fixture shape — a viewBox + a fill resolveCharge's recolorCharge can swap).
const FAKE_CHARGE_SVG = '<svg viewBox="0 0 100 100"><path fill="red" d="M10 10 L90 10 L90 90 L10 90 Z"/></svg>';

function stubR2Fetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(R2_BASE)) return { ok: true, text: async () => FAKE_CHARGE_SVG };
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}

// ── SEC-2 (final whole-branch review): the shield art-prefetch resolves ONLY
// the ONE mobile shield-charge group Shield.jsx's own toShieldView actually
// draws (`.find()`-picked), REGARDLESS of how many `kind:'charge'` entries a
// `charges` array carries — this reverts task-19's own broadening (which
// walked EVERY such entry), because an anonymous `/api/og` GET could hand it
// an arbitrarily long crafted `charges` array and turn that into an
// unbounded fan-out of concurrent R2 fetches + recolour passes for art that
// never gets composited (achievementArt.js's header has the full story). ──

test('resolveAchievementArt: resolves ONLY the first mobile shield-charge group\'s art — a second (or Nth) group\'s art is NOT prefetched (SEC-2 fan-out cap)', async () => {
  stubR2Fetch();
  // Many DISTINCT charge files on the shield — a shape the Studio UI never
  // produces today (setCharge always replaces the single group), but a
  // hand-crafted/decoded (e.g. `/api/og`) payload can carry, and in the
  // adversarial case could carry hundreds of these.
  const manyCharges = ['eagle', 'wolf', 'bear', 'stag', 'boar', 'horse', 'griffin', 'dragon'];
  const coat = {
    field: { tincture: 'Azure' },
    charges: [
      { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
      ...manyCharges.map((key) => ({ role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'charge', key } })),
    ],
  };

  const cache = await resolveAchievementArt(coat);

  const lionFile = artFile('lion', 'rampant');
  const hex = tinctureHex('Or');
  assert.ok(cache[artKey(lionFile, hex)], `expected the FIRST mobile group's art (lion) to resolve: ${JSON.stringify(Object.keys(cache))}`);
  // Exactly one entry — none of the other 8 crafted groups triggered a fetch,
  // regardless of how many the payload carried.
  assert.equal(Object.keys(cache).length, 1, `expected the prefetch bounded to 1 entry (only the drawn group), got ${JSON.stringify(Object.keys(cache))}`);
});

test('resolveAchievementArt: the first-group-only shield prefetch coexists correctly with crest + supporters resolution (full achievement, one of each, bounded to 3 total)', async () => {
  stubR2Fetch();
  const coat = withDefaultAchievement({
    field: { tincture: 'Vert' },
    charges: [
      { role: 'secondary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'wolf', attitude: 'passant' } },
      { role: 'peripheral', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'stag', attitude: 'passant' } },
    ],
  });
  // Override crest/supporters to a THIRD distinct charge so every layer's
  // art is independently verifiable in the resulting cache.
  coat.achievement.crest = { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'griffin', attitude: 'rampant' } };
  coat.achievement.supporters = { dexter: { tincture: 'Or', object: { kind: 'charge', key: 'dragon', attitude: 'rampant' } } };

  const cache = await resolveAchievementArt(coat);
  const argentHex = tinctureHex('Argent');
  const orHex = tinctureHex('Or');
  assert.ok(cache[artKey(artFile('wolf', 'passant'), argentHex)], 'first (drawn) shield charge group');
  assert.ok(!cache[artKey(artFile('stag', 'passant'), argentHex)], 'second shield charge group must NOT be prefetched (never drawn)');
  assert.ok(cache[artKey(artFile('griffin', 'rampant'), orHex)], 'crest');
  assert.ok(cache[artKey(artFile('dragon', 'rampant'), orHex)], 'supporters (matched pair)');
  assert.equal(Object.keys(cache).length, 3, 'bounded to shield + crest + supporters — never grows with extra un-drawn shield-charge groups');
});

test('resolveAchievementArt: a design with a single mobile group (the ONLY shape the Studio UI ever produces) still resolves it', async () => {
  stubR2Fetch();
  const coat = {
    field: { tincture: 'Gules' },
    charges: [{ role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
  };
  const cache = await resolveAchievementArt(coat);
  assert.equal(Object.keys(cache).length, 1);
});

test('resolveAchievementArt: an ordinary-only charges array (no mobile groups at all) needs no art from the shield side', async () => {
  stubR2Fetch();
  const coat = {
    field: { tincture: 'Gules' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } }],
  };
  const cache = await resolveAchievementArt(coat);
  assert.deepEqual(cache, {});
});

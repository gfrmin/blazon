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

// ── Task 17 residual, closed here (task-19 brief §1): the shield art-prefetch
// used to resolve only the FIRST mobile (kind:'charge') shield-charge group
// via chargeGroup()'s `.find()`. A design whose `charges` array carries a
// SECOND `kind:'charge'` entry left that second group's art unresolved. ──

test('resolveAchievementArt: prefetches art for EVERY mobile shield-charge group, not just the first', async () => {
  stubR2Fetch();
  // Two DIFFERENT charge files (lion, eagle) on the shield — a shape the
  // Studio UI never produces today (setCharge always replaces the single
  // group), but a hand-crafted/decoded coat can carry.
  const coat = {
    field: { tincture: 'Azure' },
    charges: [
      { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
      { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'eagle' } },
    ],
  };

  const cache = await resolveAchievementArt(coat);

  const lionFile = artFile('lion', 'rampant');
  const eagleFile = artFile('eagle', undefined);
  const hex = tinctureHex('Or');
  assert.ok(cache[artKey(lionFile, hex)], `expected the FIRST mobile group's art (lion) to resolve: ${JSON.stringify(Object.keys(cache))}`);
  assert.ok(cache[artKey(eagleFile, hex)], `expected the SECOND mobile group's art (eagle) to resolve too: ${JSON.stringify(Object.keys(cache))}`);
  assert.equal(Object.keys(cache).length, 2);
});

test('resolveAchievementArt: the broadened shield-charge loop coexists correctly with crest + supporters resolution (full achievement, one of each)', async () => {
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
  assert.ok(cache[artKey(artFile('wolf', 'passant'), argentHex)], 'first shield charge group');
  assert.ok(cache[artKey(artFile('stag', 'passant'), argentHex)], 'second shield charge group');
  assert.ok(cache[artKey(artFile('griffin', 'rampant'), orHex)], 'crest');
  assert.ok(cache[artKey(artFile('dragon', 'rampant'), orHex)], 'supporters (matched pair)');
});

test('resolveAchievementArt: a design with a single mobile group (the ONLY shape the Studio UI ever produces) is unaffected by the broadening', async () => {
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

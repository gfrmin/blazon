import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canRenderLocally } from '../render-capabilities.js';
import { coat } from '../model/achievement.js';

const mullets = (n) => coat({ tincture: 'Azure' }, [
  { role: 'secondary', number: n, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
]);

// Shield.jsx's chargeSlots only lays out up to 3 charges, so a higher count
// must defer to DrawShield rather than silently drawing fewer figures than the
// blazon names (S3.6).
test('a locally-drawable charge renders locally up to 3', () => {
  assert.equal(canRenderLocally(mullets(1)), true);
  assert.equal(canRenderLocally(mullets(3)), true);
});

test('more than 3 charges defers to DrawShield (count fidelity)', () => {
  assert.equal(canRenderLocally(mullets(4)), false);
  assert.equal(canRenderLocally(mullets(6)), false);
});

test('subordinaries always defer (none drawn locally yet)', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'subordinary', key: 'bordure' } },
  ]);
  assert.equal(canRenderLocally(c), false);
});

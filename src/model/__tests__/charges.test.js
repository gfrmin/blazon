import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargeNoun, chargePlain } from '../charges.js';

test('curated charges use their hand-authored plural', () => {
  assert.equal(chargeNoun('lion', true), 'lions');
  assert.equal(chargeNoun('fleurdelys', true), 'fleurs-de-lys');
  assert.equal(chargePlain('rose', true), 'roses');
});

test('catalog charges pluralise regularly (drop hyphens)', () => {
  assert.equal(chargeNoun('oak-tree'), 'oak tree');
  assert.equal(chargeNoun('oak-tree', true), 'oak trees');
  assert.equal(chargeNoun('harp', true), 'harps');
  assert.equal(chargeNoun('escallop', true), 'escallops');
  assert.equal(chargeNoun('cross', true), 'crosses');   // -s → -es
  assert.equal(chargeNoun('lozenge', true), 'lozenges'); // curated, but regular too
});

test('catalog charges: -y → -ies, irregulars, and head-noun compounds', () => {
  assert.equal(chargeNoun('lily', true), 'lilies');
  assert.equal(chargeNoun('oak-leaf', true), 'oak leaves');     // irregular leaf→leaves
  assert.equal(chargeNoun('sun-in-splendour', true), 'suns in splendour'); // head noun
  assert.equal(chargeNoun('cross-of-lorraine', true), 'crosses of lorraine');
  assert.equal(chargeNoun('fish', true), 'fish');               // unchanging
});

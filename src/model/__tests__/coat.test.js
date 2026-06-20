import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coat } from '../achievement.js';
import { blazon } from '../blazon.js';
import {
  setFieldTincture, setDivision, setDivisionPart, clearDivision,
  setOrdinary, setOrdinaryTincture, clearOrdinary,
  setCharge, setChargeAttitude, setChargeNumber, clearCharge, setMotto,
  fieldTincture, isDivided, division, primaryGroup, chargeGroup, motto,
} from '../coat.js';

const plain = (t) => coat({ tincture: t }, []);

test('setFieldTincture replaces the field', () => {
  const c = setFieldTincture(plain('Azure'), 'Gules');
  assert.equal(fieldTincture(c), 'Gules');
  assert.equal(blazon(c, 'formal'), 'Gules');
});

test('setOrdinary seeds a contrasting tincture (colour field → metal)', () => {
  const c = setOrdinary(plain('Azure'), 'fess');
  assert.ok(primaryGroup(c));
  assert.equal(blazon(c, 'formal'), 'Azure, a fess Or');
});

test('setCharge adds a secondary group; number + ordinary compose', () => {
  let c = setOrdinary(plain('Azure'), 'chevron');
  c = setChargeNumber(setCharge(c, 'mullet'), 3);
  assert.equal(blazon(c, 'formal'), 'Azure, a chevron Or between three mullets Or');
});

test('setDivision divides the field with a contrasting second tincture', () => {
  let c = setDivision(plain('Gules'), 'per fess');
  assert.ok(isDivided(c));
  assert.deepEqual(division(c).tinctures, ['Gules', 'Argent']);
  assert.equal(blazon(c, 'formal'), 'Per fess Gules and Argent');
  c = setDivisionPart(c, 1, 'Or');
  assert.equal(blazon(c, 'formal'), 'Per fess Gules and Or');
});

test('clearDivision reverts to a plain field (first part)', () => {
  const c = clearDivision(setDivision(plain('Gules'), 'quarterly'));
  assert.equal(isDivided(c), false);
  assert.equal(blazon(c, 'formal'), 'Gules');
});

test('setCharge on a beast defaults a valid attitude; swapping resets it', () => {
  let c = setCharge(plain('Azure'), 'lion');
  assert.equal(chargeGroup(c).object.attitude, 'rampant');
  assert.equal(blazon(c, 'formal'), 'Azure, a lion rampant Or');
  c = setChargeAttitude(c, 'passant');
  assert.equal(blazon(c, 'formal'), 'Azure, a lion passant Or');
  c = setCharge(c, 'fish'); // swap must reset the stale 'passant' to a fish-valid default
  assert.equal(chargeGroup(c).object.attitude, 'naiant');
  assert.equal(blazon(c, 'formal'), 'Azure, a fish naiant Or');
});

test('clearOrdinary / clearCharge remove their groups', () => {
  let c = setCharge(setOrdinary(plain('Azure'), 'fess'), 'mullet');
  c = clearOrdinary(c);
  assert.equal(primaryGroup(c), null);
  c = clearCharge(c);
  assert.equal(chargeGroup(c), null);
  assert.equal(blazon(c, 'formal'), 'Azure');
});

test('setMotto stores the motto without touching the blazon', () => {
  const c = setMotto(plain('Azure'), 'Steadfast');
  assert.equal(motto(c), 'Steadfast');
  assert.equal(blazon(c, 'formal'), 'Azure');
});

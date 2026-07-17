import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coat, withDefaultAchievement } from '../achievement.js';
import { blazon } from '../blazon.js';
import {
  setFieldTincture, setDivision, setDivisionPart, clearDivision,
  setOrdinary, setOrdinaryTincture, clearOrdinary,
  setCharge, setChargeAttitude, setChargeNumber, clearCharge, setMotto,
  fieldTincture, isDivided, division, primaryGroup, chargeGroup, motto,
  crest, helm, torse, mantling, supporters, compartment, hasAchievement,
  setCrest, setCrestTincture, setCrestAttitude, clearCrest,
  setHelm, clearHelm,
  setTorse, setMantling, clearTorse, clearMantling,
  setSupporters, setSupporterSide, clearSupporters,
  setCompartment, clearCompartment,
  restoreFullAchievement, stripAchievement,
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

// ── Achievement selectors ────────────────────────────────────────────────
test('achievement selectors read parts; all null and hasAchievement false when absent', () => {
  const c = plain('Azure');
  assert.equal(crest(c), null);
  assert.equal(helm(c), null);
  assert.equal(torse(c), null);
  assert.equal(mantling(c), null);
  assert.equal(supporters(c), null);
  assert.equal(compartment(c), null);
  assert.equal(hasAchievement(c), false);
});

// ── setCrest ─────────────────────────────────────────────────────────────
test('setCrest seeds number 1, a tincture, and a valid default attitude for a beast; returns a new object', () => {
  const before = plain('Azure');
  const pristine = JSON.parse(JSON.stringify(before));
  const c = setCrest(before, 'lion');
  assert.notStrictEqual(c, before);
  assert.deepEqual(before, pristine);
  assert.equal(crest(c).number, 1);
  assert.equal(crest(c).object.key, 'lion');
  assert.equal(crest(c).object.attitude, 'rampant');
  assert.ok(crest(c).tincture);
});

test('setCrest on a non-animate charge does not seed an attitude', () => {
  const c = setCrest(plain('Azure'), 'fleurdelys');
  assert.equal(crest(c).object.attitude, undefined);
});

test('setCrestTincture / setCrestAttitude patch the crest in place; clearCrest removes it', () => {
  const withCrest = setCrest(plain('Azure'), 'lion');
  const pristine = JSON.parse(JSON.stringify(withCrest));
  const tinted = setCrestTincture(withCrest, 'Gules');
  assert.notStrictEqual(tinted, withCrest);
  assert.deepEqual(withCrest, pristine);
  assert.equal(crest(tinted).tincture, 'Gules');

  const posed = setCrestAttitude(tinted, 'passant');
  assert.notStrictEqual(posed, tinted);
  assert.equal(crest(posed).object.attitude, 'passant');

  const cleared = clearCrest(posed);
  assert.notStrictEqual(cleared, posed);
  assert.equal(crest(cleared), null);
  assert.equal('achievement' in cleared, false); // crest was the only part set
});

// ── setHelm ──────────────────────────────────────────────────────────────
test('setHelm / clearHelm', () => {
  const before = plain('Azure');
  const withHelm = setHelm(before, 'knight');
  assert.notStrictEqual(withHelm, before);
  assert.deepEqual(helm(withHelm), { style: 'knight' });

  const cleared = clearHelm(withHelm);
  assert.notStrictEqual(cleared, withHelm);
  assert.equal(helm(cleared), null);
  assert.equal('achievement' in cleared, false);
});

// ── setTorse / setMantling ───────────────────────────────────────────────
test('setTorse / setMantling seed tinctures; clearing one leaves the other; both gone drops achievement', () => {
  const before = plain('Azure');
  const withTorse = setTorse(before, ['Or', 'Azure']);
  assert.notStrictEqual(withTorse, before);
  assert.deepEqual(torse(withTorse), { tinctures: ['Or', 'Azure'] });

  const withBoth = setMantling(withTorse, ['Azure', 'Or']);
  assert.notStrictEqual(withBoth, withTorse);
  assert.deepEqual(mantling(withBoth), { tinctures: ['Azure', 'Or'] });

  const torseCleared = clearTorse(withBoth);
  assert.notStrictEqual(torseCleared, withBoth);
  assert.equal(torse(torseCleared), null);
  assert.ok(mantling(torseCleared)); // mantling survives clearing torse

  const bothCleared = clearMantling(torseCleared);
  assert.equal(mantling(bothCleared), null);
  assert.equal('achievement' in bothCleared, false);
});

// ── setSupporters / setSupporterSide ─────────────────────────────────────
test('setSupporters seeds a matched dexter-only pair with a valid default attitude (beast)', () => {
  const before = plain('Azure');
  const pristine = JSON.parse(JSON.stringify(before));
  const c = setSupporters(before, 'wolf');
  assert.notStrictEqual(c, before);
  assert.deepEqual(before, pristine);
  assert.equal(supporters(c).dexter.object.key, 'wolf');
  assert.equal(supporters(c).dexter.object.attitude, 'passant'); // wolf's OWN valid default, not a hardcoded 'rampant'
  assert.equal('sinister' in supporters(c), false);
});

test('setSupporters on a non-animate charge does not seed an attitude', () => {
  const c = setSupporters(plain('Azure'), 'anchor');
  assert.equal(supporters(c).dexter.object.attitude, undefined);
});

test('setSupporterSide materialises sinister from dexter on first split; later edits touch only the named side', () => {
  const matched = setSupporters(plain('Azure'), 'lion');
  const split = setSupporterSide(matched, 'sinister', {
    tincture: 'Argent', object: { kind: 'charge', key: 'wolf', attitude: 'passant' },
  });
  assert.notStrictEqual(split, matched);
  assert.equal(supporters(split).dexter.object.key, 'lion'); // dexter untouched by materialising sinister
  assert.equal(supporters(split).dexter.tincture, supporters(matched).dexter.tincture);
  assert.equal(supporters(split).sinister.object.key, 'wolf');
  assert.equal(supporters(split).sinister.tincture, 'Argent');

  const dexterEdited = setSupporterSide(split, 'dexter', { tincture: 'Or' });
  assert.notStrictEqual(dexterEdited, split);
  assert.equal(supporters(dexterEdited).dexter.tincture, 'Or');
  assert.equal(supporters(dexterEdited).dexter.object.key, 'lion'); // untouched field preserved
  assert.equal(supporters(dexterEdited).sinister.object.key, 'wolf'); // sinister untouched by the dexter-only edit
});

test('setSupporterSide deep-clones nested object; partial patch does not alias sinister.object to dexter.object', () => {
  // Materialise sinister with a partial patch (only tincture, no object).
  // This is the natural UI action: change the sinister tincture while keeping the charge.
  const matched = setSupporters(plain('Azure'), 'lion');
  const split = setSupporterSide(matched, 'sinister', { tincture: 'Argent' });

  // Both sides should have lion (dexter seeded it, sinister cloned it).
  assert.equal(supporters(split).dexter.object.key, 'lion');
  assert.equal(supporters(split).sinister.object.key, 'lion');

  // Critical: sinister.object must NOT be the same reference as dexter.object.
  assert.notStrictEqual(
    supporters(split).sinister.object,
    supporters(split).dexter.object,
    'sinister.object and dexter.object must be separate instances, not aliased'
  );

  // Deep-decouple proof: mutate one side's object and verify the other is unaffected.
  const dexterObj = supporters(split).dexter.object;
  dexterObj.attitude = 'passant'; // mutate dexter's object in place

  // sinister's object should still be 'rampant' (lion's default), untouched by the mutation.
  assert.equal(
    supporters(split).sinister.object.attitude,
    'rampant',
    'sinister.object.attitude must be unaffected by direct mutation of dexter.object'
  );

  // Subsequent edit to dexter must leave sinister's tincture/object unchanged.
  const dexterRetinted = setSupporterSide(split, 'dexter', { tincture: 'Or' });
  assert.equal(supporters(dexterRetinted).dexter.tincture, 'Or');
  assert.equal(supporters(dexterRetinted).dexter.object.key, 'lion');
  assert.equal(supporters(dexterRetinted).sinister.tincture, 'Argent'); // sinister tincture unchanged
  assert.equal(supporters(dexterRetinted).sinister.object.key, 'lion'); // sinister object unchanged
});

test('setSupporterSide is a no-op (but still returns a new object) when there are no supporters yet', () => {
  const before = plain('Azure');
  const c = setSupporterSide(before, 'sinister', { tincture: 'Or' });
  assert.notStrictEqual(c, before);
  assert.equal(supporters(c), null);
});

test('clearSupporters removes the part', () => {
  const withSupp = setSupporters(plain('Azure'), 'lion');
  const cleared = clearSupporters(withSupp);
  assert.notStrictEqual(cleared, withSupp);
  assert.equal(supporters(cleared), null);
  assert.equal('achievement' in cleared, false);
});

// ── setCompartment ───────────────────────────────────────────────────────
test('setCompartment / clearCompartment', () => {
  const before = plain('Azure');
  const withComp = setCompartment(before, 'mount', 'Vert');
  assert.notStrictEqual(withComp, before);
  assert.deepEqual(compartment(withComp), { type: 'mount', tincture: 'Vert' });

  const cleared = clearCompartment(withComp);
  assert.notStrictEqual(cleared, withComp);
  assert.equal(compartment(cleared), null);
  assert.equal('achievement' in cleared, false);
});

// ── withoutPart: drops the key, and drops `achievement` entirely when empty ─
test('clearing one of several parts drops only that key; achievement key survives', () => {
  const withCrest = setCrest(plain('Azure'), 'lion');
  const withBoth = setHelm(withCrest, 'knight');
  const crestCleared = clearCrest(withBoth);
  assert.equal(crest(crestCleared), null);
  assert.deepEqual(helm(crestCleared), { style: 'knight' });
  assert.ok('achievement' in crestCleared);
});

test('clearing the last remaining part drops the `achievement` key entirely (not just to {})', () => {
  const withHelm = setHelm(plain('Azure'), 'knight');
  assert.ok('achievement' in withHelm);
  const cleared = clearHelm(withHelm);
  assert.equal('achievement' in cleared, false);
});

// ── restoreFullAchievement / stripAchievement round-trip ────────────────
test('restoreFullAchievement is withDefaultAchievement; strip -> restore round-trips; restore is idempotent', () => {
  const shield = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  ]);
  const full = restoreFullAchievement(shield);
  assert.deepEqual(full, withDefaultAchievement(shield));

  const stripped = stripAchievement(full);
  assert.equal('achievement' in stripped, false);
  assert.deepEqual(stripped, shield);

  const restoredAgain = restoreFullAchievement(full);
  assert.deepEqual(restoredAgain, full); // idempotent
});

// ── Legacy flat object accepted by every mutator ─────────────────────────
const legacyDesign = {
  field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or',
  charges: [{ type: 'mullet', tincture: 'Argent', qty: 3 }],
};

test('every achievement mutator tolerates the legacy flat object', () => {
  assert.doesNotThrow(() => setCrest(legacyDesign, 'lion'));
  assert.doesNotThrow(() => setCrestTincture(setCrest(legacyDesign, 'lion'), 'Gules'));
  assert.doesNotThrow(() => setCrestAttitude(setCrest(legacyDesign, 'lion'), 'passant'));
  assert.doesNotThrow(() => clearCrest(setCrest(legacyDesign, 'lion')));
  assert.doesNotThrow(() => setHelm(legacyDesign, 'knight'));
  assert.doesNotThrow(() => clearHelm(setHelm(legacyDesign, 'knight')));
  assert.doesNotThrow(() => setTorse(legacyDesign, ['Or', 'Gules']));
  assert.doesNotThrow(() => setMantling(legacyDesign, ['Gules', 'Or']));
  assert.doesNotThrow(() => clearTorse(setTorse(legacyDesign, ['Or', 'Gules'])));
  assert.doesNotThrow(() => clearMantling(setMantling(legacyDesign, ['Gules', 'Or'])));
  assert.doesNotThrow(() => setSupporters(legacyDesign, 'lion'));
  assert.doesNotThrow(() => setSupporterSide(
    setSupporters(legacyDesign, 'lion'), 'sinister', { tincture: 'Argent', object: { kind: 'charge', key: 'wolf' } },
  ));
  assert.doesNotThrow(() => clearSupporters(setSupporters(legacyDesign, 'lion')));
  assert.doesNotThrow(() => setCompartment(legacyDesign, 'mount', 'Vert'));
  assert.doesNotThrow(() => clearCompartment(setCompartment(legacyDesign, 'mount', 'Vert')));
  assert.doesNotThrow(() => restoreFullAchievement(legacyDesign));
  assert.doesNotThrow(() => stripAchievement(restoreFullAchievement(legacyDesign)));

  // Spot-check: output is normalized (canonical Coat), not the raw legacy shape.
  const c = setCrest(legacyDesign, 'lion');
  assert.equal(fieldTincture(c), 'Gules');
  assert.equal(crest(c).object.key, 'lion');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blazon } from '../blazon.js';
import { computeWarn } from '../validate.js';
import { coat, marshal } from '../achievement.js';

// ── Backward-compat: the legacy flat design object still blazons correctly ──
const heroLegacy = {
  field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or',
  charges: [{ type: 'mullet', tincture: 'Argent', qty: 3 }],
};

test('legacy object → formal blazon (conventionally capitalised)', () => {
  assert.equal(blazon(heroLegacy, 'formal'), 'Gules, a chevron Or between three mullets Argent');
});

test('legacy object → plain English (prototype-compatible)', () => {
  assert.equal(blazon(heroLegacy, 'plain'), 'A red shield with a gold chevron, and three silver stars.');
});

// ── Divisions, lines of partition ──
test('divided field, no charges', () => {
  assert.equal(blazon(coat({ division: { type: 'quarterly', tinctures: ['Gules', 'Or'] } }), 'formal'),
    'Quarterly Gules and Or');
});

test('per fess wavy with a charge group', () => {
  const c = coat(
    { division: { type: 'per fess', line: 'wavy', tinctures: ['Azure', 'Argent'] } },
    [{ role: 'primary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } }],
  );
  assert.equal(blazon(c, 'formal'), 'Per fess wavy Azure and Argent, three mullets Or');
});

test('repeating division takes a piece count', () => {
  assert.equal(blazon(coat({ division: { type: 'paly', count: 6, tinctures: ['Or', 'Azure'] } }), 'formal'),
    'Paly of six Or and Azure');
});

// ── Attitudes ──
test('beast with attitude', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, a lion rampant Or');
});

// ── Tincture-elision rule (a run of same-tincture charges names it once, last) ──
test('tincture elision across consecutive same-tincture charges', () => {
  const c = coat({ tincture: 'Vert' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'chevron' } },
    { role: 'secondary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'crescent' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Vert, a chevron Or between three mullets, a crescent Or');
});

// ── Marshalling ──
test('quarterly marshalling of two coats', () => {
  const a = coat({ tincture: 'Gules' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  ]);
  const b = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.equal(blazon(marshal('quarterly', [a, b]), 'formal'),
    'Quarterly, 1 and 4 Gules, a lion rampant Or; 2 and 3 Azure, three mullets Or');
});

// ── Tincture-rule validation ──
test('metal on metal warns (field vs ordinary)', () => {
  const w = computeWarn({ field: 'Or', ordinary: 'fess', ordinaryTincture: 'Argent', charges: [] });
  assert.ok(w && /Metal on metal/.test(w));
});

test('proper contrast does not warn', () => {
  assert.equal(computeWarn({ field: 'Azure', ordinary: 'fess', ordinaryTincture: 'Or', charges: [] }), null);
});

test('fur field is neutral (no clash with a metal ordinary)', () => {
  const c = coat({ tincture: 'Ermine' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } },
  ]);
  assert.equal(computeWarn(c), null);
});

test("'proper' charge is exempt from the tincture rule", () => {
  const c = coat({ tincture: 'Argent' }, [
    { role: 'primary', number: 1, tincture: 'proper', object: { kind: 'charge', key: 'anchor' } },
  ]);
  assert.equal(computeWarn(c), null);
});

test('invalid attitude warns (a fish cannot be rampant)', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'fish', attitude: 'rampant' } },
  ]);
  const w = computeWarn(c);
  assert.ok(w && /can't be rampant/.test(w), w);
});

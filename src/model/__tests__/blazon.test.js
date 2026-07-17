import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blazon } from '../blazon.js';
import { computeWarn } from '../validate.js';
import { coat, marshal, withDefaultAchievement } from '../achievement.js';

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

// ─────────────────────────────────────────────────────────────────────────
// Achievement clauses (M2/A3) — formal + plain, appended AFTER the escutcheon.
// ─────────────────────────────────────────────────────────────────────────

// Shared shield for the achievement fixtures below: Azure, a fess Or between
// three mullets Argent (matches the brief's own worked example shield).
const heraldShield = coat({ tincture: 'Azure' }, [
  { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } },
  { role: 'secondary', number: 3, tincture: 'Argent', object: { kind: 'charge', key: 'mullet' } },
]);

// ── Regression lock: shield-only coats (no `achievement`) are BYTE-IDENTICAL
// to pre-achievement output, in both languages. This is the highest-risk
// part of this task — these must never change. ──
test('regression lock: shield-only coat formal output is unchanged (no achievement clauses)', () => {
  assert.equal(blazon(heraldShield, 'formal'), 'Azure, a fess Or between three mullets Argent');
});

test('regression lock: shield-only coat plain output is unchanged (no achievement clauses)', () => {
  assert.equal(blazon(heraldShield, 'plain'), 'A blue shield with a gold fess, and three silver stars.');
});

test('regression lock: legacy flat object is still byte-identical (formal + plain)', () => {
  assert.equal(blazon(heroLegacy, 'formal'), 'Gules, a chevron Or between three mullets Argent');
  assert.equal(blazon(heroLegacy, 'plain'), 'A red shield with a gold chevron, and three silver stars.');
});

test('regression lock: divided-field coat with no achievement is unaffected', () => {
  assert.equal(blazon(coat({ division: { type: 'quarterly', tinctures: ['Gules', 'Or'] } }), 'formal'),
    'Quarterly Gules and Or');
});

// ── Full default achievement (crest+torse, mantling, matched supporters; esquire helm hidden) ──
const fullAchievement = withDefaultAchievement(heraldShield);

test('formal: full default achievement — crest with torse, mantling, matched supporters; esquire helm NOT emitted', () => {
  assert.equal(
    blazon(fullAchievement, 'formal'),
    'Azure, a fess Or between three mullets Argent. Crest: on a torse Or and Azure, a mullet Argent. '
      + 'Mantling: Azure doubled Or. Supporters: two lions rampant Or.',
  );
  assert.doesNotMatch(blazon(fullAchievement, 'formal'), /Helm:/);
});

test('plain: full default achievement — same set, herald-plain prose', () => {
  assert.equal(
    blazon(fullAchievement, 'plain'),
    'A blue shield with a gold fess, and three silver stars. '
      + 'Above the shield, a silver star stands on a twisted wreath of gold and blue. '
      + 'The mantling — the cloth behind the shield — is blue lined with gold. '
      + 'Two gold lions hold the shield up.',
  );
});

// ── Crest: with torse vs without ──
test('formal: crest only, no torse — just the crest group, no stray punctuation', () => {
  const c = { ...fullAchievement, achievement: { crest: fullAchievement.achievement.crest } };
  assert.equal(blazon(c, 'formal'), 'Azure, a fess Or between three mullets Argent. Crest: a mullet Argent.');
});

test('plain: crest only, no torse — no wreath clause', () => {
  const c = { ...fullAchievement, achievement: { crest: fullAchievement.achievement.crest } };
  assert.equal(
    blazon(c, 'plain'),
    'A blue shield with a gold fess, and three silver stars. Above the shield, a silver star stands.',
  );
});

// ── Supporters: matched vs split pair ──
const splitSupporters = {
  dexter: { tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  sinister: { tincture: 'Argent', object: { kind: 'charge', key: 'wolf', attitude: 'passant' } },
};

test('formal: split supporters name dexter/sinister in bearer convention', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, supporters: splitSupporters } };
  assert.match(blazon(c, 'formal'), /Supporters: on the dexter a lion rampant Or, and on the sinister a wolf passant Argent\.$/);
});

test('plain: split supporters describe the VIEWER perspective (dexter = viewer-left, sinister = viewer-right)', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, supporters: splitSupporters } };
  assert.match(blazon(c, 'plain'), /A gold lion holds the shield on the left, and a silver wolf on the right\.$/);
});

// ── Helm: non-default rank emitted; esquire (default) never emitted ──
test('formal: non-default helm (knight) is emitted using HELMETS.formal verbatim', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, helm: { style: 'knight' } } };
  assert.match(blazon(c, 'formal'), /Helm: a knight's helmet\./);
});

test('plain: non-default helm (knight) stated neutrally', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, helm: { style: 'knight' } } };
  assert.match(blazon(c, 'plain'), /The helm is a knight's\./);
});

test('formal: esquire helm (default) is never emitted, even set explicitly', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, helm: { style: 'esquire' } } };
  assert.doesNotMatch(blazon(c, 'formal'), /Helm:/);
});

test('plain: esquire helm (default) is never mentioned, even set explicitly', () => {
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, helm: { style: 'esquire' } } };
  assert.doesNotMatch(blazon(c, 'plain'), /helm/i);
});

// ── Compartment: emitted when present ──
test('formal: compartment clause appended when present', () => {
  const c = {
    ...fullAchievement,
    achievement: { ...fullAchievement.achievement, compartment: { type: 'mount', tincture: 'Vert' } },
  };
  assert.equal(
    blazon(c, 'formal'),
    'Azure, a fess Or between three mullets Argent. Crest: on a torse Or and Azure, a mullet Argent. '
      + 'Mantling: Azure doubled Or. Supporters: two lions rampant Or. Compartment: a mount Vert.',
  );
});

test('plain: compartment clause appended when present', () => {
  const c = {
    ...fullAchievement,
    achievement: { ...fullAchievement.achievement, compartment: { type: 'mount', tincture: 'Vert' } },
  };
  assert.match(blazon(c, 'plain'), /The shield stands on a mount of green\.$/);
});

// ── Motto is NEVER in the formal blazon (it lives on Coat, shown separately) ──
test('formal: motto is never included, even when coat.motto is set', () => {
  const c = { ...fullAchievement, motto: 'Fortis et Fidelis' };
  const out = blazon(c, 'formal');
  assert.doesNotMatch(out, /Fortis/);
  assert.doesNotMatch(out, /[Mm]otto/);
  assert.equal(out, blazon(fullAchievement, 'formal')); // motto changes nothing about the formal output
});

// ─────────────────────────────────────────────────────────────────────────
// Achievement validation (M2/A4+A5, Task 11) — attitude validity for crest/
// supporters, and motto length. The tincture rule deliberately does NOT
// extend to crest/supporters: the crest sits on a torse (not the field) and
// supporters stand outside the field entirely, so "clashes with the field"
// isn't a heraldic concept for either of them.
// ─────────────────────────────────────────────────────────────────────────

test('fish-rampant supporter warns (attitude invalid for the charge)', () => {
  const badSupporters = { dexter: { tincture: 'Or', object: { kind: 'charge', key: 'fish', attitude: 'rampant' } } };
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, supporters: badSupporters } };
  const w = computeWarn(c);
  assert.ok(w && /can't be rampant/.test(w), w);
});

test('a valid supporter attitude does not warn', () => {
  const okSupporters = { dexter: { tincture: 'Or', object: { kind: 'charge', key: 'fish', attitude: 'naiant' } } };
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, supporters: okSupporters } };
  assert.equal(computeWarn(c), null);
});

test('an invalid SINISTER supporter attitude (a split pair) also warns', () => {
  const splitBad = {
    dexter: { tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
    sinister: { tincture: 'Argent', object: { kind: 'charge', key: 'fish', attitude: 'rampant' } },
  };
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, supporters: splitBad } };
  const w = computeWarn(c);
  assert.ok(w && /can't be rampant/.test(w), w);
});

test('an invalid crest attitude warns', () => {
  const badCrest = { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'fish', attitude: 'rampant' } };
  const c = { ...fullAchievement, achievement: { ...fullAchievement.achievement, crest: badCrest } };
  const w = computeWarn(c);
  assert.ok(w && /can't be rampant/.test(w), w);
});

test('the tincture rule does not apply to the crest against the field (heraldically it sits on a torse, not the field)', () => {
  // Field is Azure (colour); crest tincture also Azure (same class) — this
  // would trip the shield's metal/colour rule if it applied here. It must not.
  const c = {
    ...heraldShield,
    achievement: {
      crest: { role: 'primary', number: 1, tincture: 'Azure', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
    },
  };
  assert.equal(computeWarn(c), null);
});

test('the tincture rule does not apply to supporters against the field (they stand outside the field)', () => {
  const c = {
    ...heraldShield,
    achievement: {
      supporters: { dexter: { tincture: 'Azure', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } } },
    },
  };
  assert.equal(computeWarn(c), null);
});

test('motto at 30 characters is fine; 31 warns', () => {
  const ok = { ...heraldShield, motto: 'x'.repeat(30) };
  const tooLong = { ...heraldShield, motto: 'x'.repeat(31) };
  assert.equal(computeWarn(ok), null);
  const w = computeWarn(tooLong);
  assert.ok(w && /30/.test(w) && /scroll/.test(w), w);
});

test('validation warnings are non-blocking: computeWarn always returns a string or null, never throws', () => {
  const c = { ...heraldShield, motto: 'x'.repeat(50) };
  assert.doesNotThrow(() => computeWarn(c));
  assert.equal(typeof computeWarn(c), 'string');
  assert.equal(computeWarn(fullAchievement), null); // the default full achievement is itself clean
});

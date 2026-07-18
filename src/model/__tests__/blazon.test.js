import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blazon } from '../blazon.js';
import { computeWarn, validateDesignShape } from '../validate.js';
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

// ── Field treatment (semy/fretty/masoned) — modelled + blazoned (renders via
//    DrawShield; see render-capabilities). ──
test('a field treatment is named in the formal blazon', () => {
  assert.equal(blazon(coat({ tincture: 'Azure', treatment: { type: 'semy', of: 'estoiles' } }), 'formal'),
    'Azure semy of estoiles');
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
// The elision also spans "between": an ordinary that shares the charges'
// tincture is not re-named — "a chevron between three mullets … Or", not
// "a chevron Or between three mullets … Or".
test('tincture elision across consecutive same-tincture charges (including the ordinary before "between")', () => {
  const c = coat({ tincture: 'Vert' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'chevron' } },
    { role: 'secondary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'crescent' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Vert, a chevron between three mullets, a crescent Or');
});

// The ordinary IS named when its tincture differs from the charges' (no elision).
test('no elision across "between" when the ordinary tincture differs', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } },
    { role: 'secondary', number: 3, tincture: 'Argent', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, a fess Or between three mullets Argent');
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

// Plain mode is deliberately jargon-free: an ordinary reads by its gloss
// ("horizontal band"), not the heraldic noun ("fess") — see groupPlain +
// ORDINARIES[*].plain. (The formal blazon still says "fess".)
test('regression lock: shield-only coat plain output uses the jargon-free ordinary gloss', () => {
  assert.equal(blazon(heraldShield, 'plain'), 'A blue shield with a gold horizontal band, and three silver stars.');
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

// NOTE: heraldShield's principal charge is a mullet, which has no vendored
// crest art (src/charges/manifest.js's `hasArt`) — `defaultCrest` therefore
// falls back to the lion-rampant-Or figure (matching `defaultSupporters`'s
// own no-art fallback) instead of echoing a charge it can't actually draw
// above the torse. See src/model/achievement.js's `defaultCrest`.
test('formal: full default achievement — crest with torse, mantling, matched supporters; esquire helm NOT emitted', () => {
  assert.equal(
    blazon(fullAchievement, 'formal'),
    'Azure, a fess Or between three mullets Argent. Crest: on a torse Or and Azure, a lion rampant Or. '
      + 'Mantling: Azure doubled Or. Supporters: two lions rampant Or.',
  );
  assert.doesNotMatch(blazon(fullAchievement, 'formal'), /Helm:/);
});

test('plain: full default achievement — same set, herald-plain prose', () => {
  assert.equal(
    blazon(fullAchievement, 'plain'),
    'A blue shield with a gold horizontal band, and three silver stars. '
      + 'Above the shield, a gold lion rearing up stands on a twisted wreath of gold and blue. '
      + 'The mantling — the cloth behind the shield — is blue lined with gold. '
      + 'Two gold lions hold the shield up.',
  );
});

// ── Crest: with torse vs without ──
test('formal: crest only, no torse — just the crest group, no stray punctuation', () => {
  const c = { ...fullAchievement, achievement: { crest: fullAchievement.achievement.crest } };
  assert.equal(blazon(c, 'formal'), 'Azure, a fess Or between three mullets Argent. Crest: a lion rampant Or.');
});

test('plain: crest only, no torse — no wreath clause', () => {
  const c = { ...fullAchievement, achievement: { crest: fullAchievement.achievement.crest } };
  assert.equal(
    blazon(c, 'plain'),
    'A blue shield with a gold horizontal band, and three silver stars. Above the shield, a gold lion rearing up stands.',
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
    'Azure, a fess Or between three mullets Argent. Crest: on a torse Or and Azure, a lion rampant Or. '
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

// ── I1 (final whole-branch review): blazon() must never throw on a malformed
// coat — a charge/crest/supporter `object` missing its `key` (an unvalidated
// /api/generate response truncated at max_tokens, or a hand-crafted /a/|#
// share payload) previously crashed deep inside chargeNoun/chargePlain
// (`undefined.replace`), which Achievement.jsx's aria-label computes on
// EVERY render — with no error boundary (the other half of this fix,
// src/ErrorBoundary.jsx), that took down the whole app. ──

test('blazon(): a shield charge object missing `key` does not throw, in either language', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge' } }, // no `key`
  ]);
  assert.doesNotThrow(() => blazon(c, 'formal'));
  assert.doesNotThrow(() => blazon(c, 'plain'));
  assert.equal(typeof blazon(c, 'formal'), 'string');
});

test('blazon(): a crest object missing `key` does not throw', () => {
  const c = {
    ...heraldShield,
    achievement: { crest: { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge' } } }, // no `key`
  };
  assert.doesNotThrow(() => blazon(c, 'formal'));
  assert.doesNotThrow(() => blazon(c, 'plain'));
});

test('blazon(): a supporter object missing `key` does not throw', () => {
  const c = {
    ...heraldShield,
    achievement: {
      supporters: { dexter: { tincture: 'Or', object: { kind: 'charge' } } }, // no `key`
    },
  };
  assert.doesNotThrow(() => blazon(c, 'formal'));
  assert.doesNotThrow(() => blazon(c, 'plain'));
});

// ─────────────────────────────────────────────────────────────────────────
// Peripheral subordinaries (S3.1) — bordure/orle/tressure enclose ("within a
// bordure Or"); a chief is apposed and blazoned last; neither enters the
// primary "…between…" construction the way a central ordinary does.
// ─────────────────────────────────────────────────────────────────────────

test('an enclosing subordinary reads "within a bordure Or" after the charges', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
    { role: 'peripheral', number: 1, tincture: 'Gules', object: { kind: 'subordinary', key: 'bordure' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, three mullets Or within a bordure Gules');
});

test('a bordure with no other charge is simply apposed to the field (no dangling "within")', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'subordinary', key: 'bordure' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, a bordure Or');
});

test('a chief is apposed (not "within") and blazoned after everything else', () => {
  const c = coat({ tincture: 'Vert' }, [
    { role: 'secondary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
    { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'subordinary', key: 'chief' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Vert, a lion rampant Argent, a chief Or');
});

test('a peripheral subordinary never enters the primary "between" clause', () => {
  // A bordure is NOT a central ordinary: it must not read "a bordure … between …".
  const c = coat({ tincture: 'Azure' }, [
    { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'subordinary', key: 'bordure' } },
    { role: 'secondary', number: 3, tincture: 'Argent', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.doesNotMatch(blazon(c, 'formal'), /bordure.*between/);
  assert.equal(blazon(c, 'formal'), 'Azure, three mullets Argent within a bordure Or');
});

// ── Tertiary charges sit ON the primary ordinary (S3.2) ──
test('tertiary charges blazon "on the fess, …" referencing the primary ordinary', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } },
    { role: 'tertiary', number: 3, tincture: 'Gules', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, a fess Or, on the fess, three mullets Gules');
});

// ── Plain-mode 'proper' and missing tincture (S3.3) ──
test("plain: 'proper' reads as a trailing 'in natural colours', not a leading adjective", () => {
  const c = coat({ tincture: 'Argent' }, [
    { role: 'primary', number: 1, tincture: 'proper', object: { kind: 'charge', key: 'anchor' } },
  ]);
  assert.equal(blazon(c, 'plain'), 'A silver shield with an anchor in natural colours.');
});

test('plain: a missing charge tincture produces no double space or wrong article', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 3, tincture: null, object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.equal(blazon(c, 'plain'), 'A blue shield with three stars.');
});

// ── flaunches singular noun (S3.7) ──
test('a single flaunch blazons "a flaunch", not "a flaunches"', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'peripheral', number: 1, tincture: 'Or', object: { kind: 'subordinary', key: 'flaunches' } },
  ]);
  assert.equal(blazon(c, 'formal'), 'Azure, a flaunch Or');
});

// ── Legacy attitude preservation (S3.5) — the landing reel's lion rampant ──
test('a legacy charge with an attitude blazons "a lion rampant", not a bare "a lion"', () => {
  const legacy = { field: 'Gules', ordinary: null, charges: [{ type: 'lion', tincture: 'Or', qty: 1, attitude: 'rampant' }] };
  assert.equal(blazon(legacy, 'formal'), 'Gules, a lion rampant Or');
  assert.equal(blazon(legacy, 'plain'), 'A red shield with a gold lion rearing up.');
});

// ── Bare-partial normalize wraps legacy charges rather than passing them raw (S3.5) ──
test('blazon(): a bare-partial coat with legacy-shaped charges does not throw', () => {
  const bare = { field: 'Azure', charges: [{ type: 'mullet', tincture: 'Or', qty: 2 }] };
  assert.doesNotThrow(() => blazon(bare, 'formal'));
  assert.equal(blazon(bare, 'formal'), 'Azure, two mullets Or');
});

// ── validateDesignShape (S4.4) — the hard structural check the generation
// endpoint runs on model output before returning it. ──
test('validateDesignShape accepts a sound coat (single tincture and a division)', () => {
  assert.equal(validateDesignShape({ field: { tincture: 'Azure' }, charges: [] }), null);
  assert.equal(validateDesignShape({
    field: { division: { type: 'per pale', tinctures: ['Or', 'Azure'] } },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } }],
  }), null);
});

test('validateDesignShape rejects malformed shapes with a specific error code', () => {
  assert.equal(validateDesignShape(null), 'not_an_object');
  assert.equal(validateDesignShape({ charges: [] }), 'missing_field');
  assert.equal(validateDesignShape({ field: { tincture: 'Or' } }), 'missing_charges');
  assert.equal(validateDesignShape({ field: { tincture: 42 }, charges: [] }), 'invalid_field');
  assert.equal(validateDesignShape({
    field: { tincture: 'Or' }, charges: [{ object: { kind: 'charge' } }],
  }), 'invalid_charge_key');
});

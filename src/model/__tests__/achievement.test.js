import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HELMETS, ACHIEVEMENT_PARTS,
  normalize, coat,
  hasAchievement, liveryTinctures, withDefaultAchievement, stripAchievement,
} from '../achievement.js';
import { ACHIEVEMENT_ART } from '../../achievement-art/manifest.js';

// ── HELMETS: vendored-rank reconciliation (Task 8 vendored 5, not 4) ──

test('HELMETS is keyed to exactly the five vendored helmet ranks', () => {
  const vendoredRanks = ACHIEVEMENT_ART.filter((a) => a.kind === 'helmet').map((a) => a.rank).sort();
  assert.deepEqual(Object.keys(HELMETS).sort(), ['baronet', 'esquire', 'knight', 'peer', 'royal']);
  assert.deepEqual(Object.keys(HELMETS).sort(), vendoredRanks);
});

test('every HELMETS entry has plain/formal/tier', () => {
  for (const [key, h] of Object.entries(HELMETS)) {
    assert.equal(typeof h.plain, 'string', `${key}.plain`);
    assert.equal(typeof h.formal, 'string', `${key}.formal`);
    assert.equal(typeof h.tier, 'number', `${key}.tier`);
  }
});

test('esquire (the default rank) is the lowest-tier helmet', () => {
  for (const key of Object.keys(HELMETS)) {
    if (key === 'esquire') continue;
    assert.ok(HELMETS.esquire.tier <= HELMETS[key].tier, `esquire should be <= ${key}`);
  }
});

test('ACHIEVEMENT_PARTS lists torse, not wreath', () => {
  assert.deepEqual(ACHIEVEMENT_PARTS, ['crest', 'helm', 'torse', 'mantling', 'supporters', 'compartment']);
});

// ── normalize(): achievement-bearing coats pass through untouched ──

const coatWithAchievement = {
  field: { tincture: 'Gules' },
  charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } }],
  achievement: {
    crest: { role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
    helm: { style: 'esquire' },
  },
};

test('normalize passes an achievement-bearing coat through unchanged', () => {
  assert.deepEqual(normalize(coatWithAchievement), coatWithAchievement);
});

test('normalize of a legacy flat object has no achievement key', () => {
  const legacy = { field: 'Gules', ordinary: 'fess', ordinaryTincture: 'Or', charges: [] };
  const c = normalize(legacy);
  assert.equal('achievement' in c, false);
});

test('normalize of a shield-only bare partial has no achievement key', () => {
  const c = normalize({ field: 'Azure' });
  assert.equal('achievement' in c, false);
});

// ── withDefaultAchievement ──

test('withDefaultAchievement is idempotent', () => {
  const base = coat({ tincture: 'Gules' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  ]);
  const once = withDefaultAchievement(base);
  const twice = withDefaultAchievement(once);
  assert.deepEqual(twice, once);
});

test('withDefaultAchievement fills only missing parts (pre-set crest/helm survive verbatim)', () => {
  const preset = {
    crest: { role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'eagle', attitude: 'displayed' } },
    helm: { style: 'peer' },
  };
  const base = { ...coat({ tincture: 'Gules' }, []), achievement: preset };
  const filled = withDefaultAchievement(base);
  assert.deepEqual(filled.achievement.crest, preset.crest);
  assert.deepEqual(filled.achievement.helm, preset.helm);
  assert.ok(filled.achievement.torse);
  assert.ok(filled.achievement.mantling);
  assert.ok(filled.achievement.supporters);
  assert.equal('compartment' in filled.achievement, false);
});

// ── liveryTinctures ──

test('liveryTinctures: colour field + metal charge', () => {
  const c = coat({ tincture: 'Gules' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.deepEqual(liveryTinctures(c), { colour: 'Gules', metal: 'Or' });
});

test('liveryTinctures: metal field + colour charge', () => {
  const c = coat({ tincture: 'Or' }, [
    { role: 'secondary', number: 1, tincture: 'Azure', object: { kind: 'charge', key: 'mullet' } },
  ]);
  assert.deepEqual(liveryTinctures(c), { colour: 'Azure', metal: 'Or' });
});

test('liveryTinctures: divided field supplies both tinctures', () => {
  const c = { field: { division: { type: 'per pale', tinctures: ['Gules', 'Or'] } }, charges: [] };
  assert.deepEqual(liveryTinctures(c), { colour: 'Gules', metal: 'Or' });
});

test('liveryTinctures: fur-only field falls back to Gules/Argent', () => {
  const c = coat({ tincture: 'Ermine' }, []);
  assert.deepEqual(liveryTinctures(c), { colour: 'Gules', metal: 'Argent' });
});

test('liveryTinctures: charges-only (field has no usable tincture)', () => {
  const c = {
    field: {},
    charges: [
      { role: 'primary', number: 1, tincture: 'Sable', object: { kind: 'ordinary', key: 'fess' } },
      { role: 'secondary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'mullet' } },
    ],
  };
  assert.deepEqual(liveryTinctures(c), { colour: 'Sable', metal: 'Argent' });
});

// ── Crest echo ──

test('crest echo: coat with a lion charge → crest echoes that lion', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } },
  ]);
  const filled = withDefaultAchievement(c);
  assert.equal(filled.achievement.crest.object.key, 'lion');
  assert.equal(filled.achievement.crest.tincture, 'Or');
  assert.equal(filled.achievement.crest.number, 1);
});

test('crest echo: coat with only an ordinary → crest is the lion-rampant fallback', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'primary', number: 1, tincture: 'Gules', object: { kind: 'ordinary', key: 'fess' } },
  ]);
  const filled = withDefaultAchievement(c);
  assert.equal(filled.achievement.crest.object.key, 'lion');
  assert.equal(filled.achievement.crest.object.attitude, 'rampant');
  assert.equal(filled.achievement.crest.tincture, 'Or'); // fixed fallback, independent of the fess's Gules
});

// ── Supporters ──

test('supporters default is a matched pair (sinister absent) of the principal beast', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'wolf', attitude: 'passant' } },
  ]);
  const filled = withDefaultAchievement(c);
  assert.equal(filled.achievement.supporters.dexter.object.key, 'wolf');
  assert.equal(filled.achievement.supporters.dexter.tincture, 'Argent');
  assert.equal('sinister' in filled.achievement.supporters, false);
});

test('supporters default falls back to lions rampant Or when the coat has no beast', () => {
  const c = coat({ tincture: 'Azure' }, [
    { role: 'secondary', number: 3, tincture: 'Or', object: { kind: 'charge', key: 'mullet' } },
  ]);
  const filled = withDefaultAchievement(c);
  assert.equal(filled.achievement.supporters.dexter.object.key, 'lion');
  assert.equal(filled.achievement.supporters.dexter.object.attitude, 'rampant');
  assert.equal(filled.achievement.supporters.dexter.tincture, 'Or');
  assert.equal('sinister' in filled.achievement.supporters, false);
});

// ── stripAchievement ──

test('stripAchievement removes the achievement key entirely', () => {
  const withAch = withDefaultAchievement(coat({ tincture: 'Gules' }, []));
  const stripped = stripAchievement(withAch);
  assert.equal('achievement' in stripped, false);
});

test('strip∘withDefault round-trip returns a coat deep-equal to the original', () => {
  const original = coat({ tincture: 'Gules' }, [
    { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'rose' } },
  ]);
  const roundTripped = stripAchievement(withDefaultAchievement(original));
  assert.deepEqual(roundTripped, original);
});

// ── hasAchievement ──

test('hasAchievement: false when there is no achievement member', () => {
  assert.equal(hasAchievement(coat({ tincture: 'Gules' }, [])), false);
});

test('hasAchievement: false when achievement is present but empty', () => {
  assert.equal(hasAchievement({ field: { tincture: 'Gules' }, charges: [], achievement: {} }), false);
});

test('hasAchievement: true when achievement has content', () => {
  assert.equal(hasAchievement(withDefaultAchievement(coat({ tincture: 'Gules' }, []))), true);
});

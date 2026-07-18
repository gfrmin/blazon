import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toDrawShieldBlazon, drawShieldURL } from '../drawshield.js';
import { coat, withDefaultAchievement } from '../achievement.js';

// Task 10 review finding (brief §3a): blazon(d,'formal') appends achievement
// clauses ("Crest: …", "Supporters: …", "Mantling: …", "Helm: …",
// "Compartment: …") after the escutcheon sentence. toDrawShieldBlazon feeds its
// output to the REAL DrawShield API as a `blazon` query param — those clauses
// are plain-English-labelled prose, not DrawShield blazon grammar, so a design
// with an out-of-vocab escutcheon AND an achievement must never leak them.
// Achievement furniture is always rendered locally; DrawShield only ever sees
// the shield-only escutcheon.
const CLAUSE_RE = /Crest:|Supporters:|Mantling:|Helm:|Compartment:/;

test('toDrawShieldBlazon strips the achievement — no clause leak', () => {
  const base = coat(
    { tincture: 'Azure' },
    [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
  );
  const withAch = withDefaultAchievement(base);
  assert.ok(withAch.achievement && withAch.achievement.crest, 'sanity: coat really carries an achievement');

  const blazonStr = toDrawShieldBlazon(withAch);
  assert.doesNotMatch(blazonStr, CLAUSE_RE);
  assert.match(blazonStr, /Azure/);
  assert.match(blazonStr, /lion/);
});

test('drawShieldURL blazon param has no achievement clauses for an achievement-bearing coat', () => {
  const base = coat(
    { tincture: 'Gules' },
    [{ role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'ordinary', key: 'fess' } }],
  );
  const withAch = withDefaultAchievement(base);
  const url = drawShieldURL(withAch);
  const blazonParam = new URL(url).searchParams.get('blazon');
  assert.ok(blazonParam.length > 0);
  assert.doesNotMatch(blazonParam, CLAUSE_RE);
});

test('toDrawShieldBlazon output for an achievement-bearing coat equals the plain-escutcheon blazon', () => {
  const base = coat({ tincture: 'Vert' }, []);
  const withAch = withDefaultAchievement(base);
  assert.equal(toDrawShieldBlazon(withAch), toDrawShieldBlazon(base));
});

test('a coat with no achievement at all is unaffected (regression lock)', () => {
  const base = coat(
    { tincture: 'Sable' },
    [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'bend' } }],
  );
  assert.equal(toDrawShieldBlazon(base), 'Sable, a bend Or');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRICING_TIERS } from '../pricing.js';

test('exactly three tiers — no Membership, no fourth tier', () => {
  assert.equal(PRICING_TIERS.length, 3);
  assert.deepEqual(PRICING_TIERS.map((p) => p.id), ['free', 'files', 'print']);
});

test('no tier is (or is named) a subscription/membership', () => {
  for (const p of PRICING_TIERS) {
    assert.ok(!/membership|subscription|\/mo\b/i.test(`${p.tier} ${p.priceLabel}`));
  }
});

test('exactly one highlighted tier: the $19 Files purchase', () => {
  const highlighted = PRICING_TIERS.filter((p) => p.highlight);
  assert.equal(highlighted.length, 1);
  assert.equal(highlighted[0].id, 'files');
  assert.equal(highlighted[0].priceLabel, '$19');
});

test('exactly one comingSoon tier: print — muted, not a buy button', () => {
  const soon = PRICING_TIERS.filter((p) => p.comingSoon);
  assert.equal(soon.length, 1);
  assert.equal(soon[0].id, 'print');
  assert.ok(!soon[0].highlight, 'a coming-soon tier must never also be the highlighted (buyable) card');
});

test('free tier is actually free', () => {
  const free = PRICING_TIERS.find((p) => p.id === 'free');
  assert.equal(free.priceLabel, 'Free');
  assert.equal(free.comingSoon, false);
});

test('every tier has non-empty tier/priceLabel/body strings', () => {
  for (const p of PRICING_TIERS) {
    assert.ok(p.tier && p.tier.trim());
    assert.ok(p.priceLabel && p.priceLabel.trim());
    assert.ok(p.body && p.body.trim());
  }
});

// task-21 Minor (folded in from Task 20's review): the coming-soon print
// tier's body must read as a plan, not a live, present-tense active
// service — a skimmer shouldn't be able to mistake it for something they
// can order today just because it sits next to a small "· coming soon" label.
test('the coming-soon print tier body does not open with a present-tense active verb', () => {
  const print = PRICING_TIERS.find((p) => p.id === 'print');
  assert.ok(!/^(printed|delivered|shipped|framed)\b/i.test(print.body), `body reads present-tense: "${print.body}"`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost, DESIGN_TOOL, resolveCharges, ORDINARY_KEYS, HELM_STYLES } from '../generate.js';
import { LOCAL_ORDINARIES, LOCAL_DIVISIONS } from '../../../src/render-capabilities.js';
import { SUBORDINARIES } from '../../../src/model/ordinaries.js';
import { HELMETS as VENDORED_HELMETS } from '../../../src/achievement-art/manifest.js';

// ─────────────────────────────────────────────────────────────────────────
// Never call the real Anthropic API from tests — every onRequestPost() test
// below stubs globalThis.fetch (branching on the request URL) so no network
// call ever leaves the process.
// ─────────────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function fakeRequest(body) {
  return { headers: { get: () => '198.51.100.1' }, json: async () => body };
}

/** Stub fetch: Turnstile siteverify always succeeds; Anthropic returns a fixed tool_use input. */
function stubFetch(toolInput) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('turnstile')) return { ok: true, json: async () => ({ success: true }) };
    if (u.includes('anthropic')) {
      return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'render_arms', input: toolInput }] }) };
    }
    throw new Error(`unexpected fetch() call in test: ${u}`);
  };
}

const BASE_ENV = { TURNSTILE_SECRET_KEY: 'ts-secret', ANTHROPIC_API_KEY: 'sk-ant-test' };

// ── 1. Enum derivation — the tool schema must be built FROM the live
//    capability tables, never a hand-copied list that can drift. ──────────

test('division enum is exactly LOCAL_DIVISIONS, and the line property is dropped', () => {
  const divisionSchema = DESIGN_TOOL.input_schema.properties.field.properties.division.properties;
  assert.deepEqual(divisionSchema.type.enum, LOCAL_DIVISIONS);
  assert.equal(divisionSchema.type.enum.includes('paly'), false); // a repeating pattern the renderer can't draw
  assert.equal('line' in divisionSchema, false); // fancy lines of partition are not offered at all
});

test('charge-object kind enum excludes subordinary (none render locally)', () => {
  const kindEnum = DESIGN_TOOL.input_schema.properties.charges.items.properties.object.properties.kind.enum;
  assert.deepEqual(kindEnum, ['ordinary', 'charge']);
});

test('ordinary vocabulary is exactly LOCAL_ORDINARIES — nothing from the wider ORDINARIES/SUBORDINARIES surface', () => {
  assert.deepEqual(ORDINARY_KEYS, LOCAL_ORDINARIES);
  assert.equal(LOCAL_ORDINARIES.includes('pile'), false); // a real ORDINARIES entry Shield.jsx doesn't draw

  const keyDesc = DESIGN_TOOL.input_schema.properties.charges.items.properties.object.properties.key.description;
  // Every locally-renderable ordinary is offered...
  assert.ok(keyDesc.includes(LOCAL_ORDINARIES.join(', ')));
  // ...and no subordinary key ever appears in the guidance text.
  for (const k of Object.keys(SUBORDINARIES)) {
    assert.equal(new RegExp(`\\b${k}\\b`).test(keyDesc), false, `subordinary "${k}" must not be offered`);
  }
});

test('helm style enum is derived from the vendored achievement art, not hardcoded', () => {
  const helmEnum = DESIGN_TOOL.input_schema.properties.achievement.properties.helm.properties.style.enum;
  const expected = VENDORED_HELMETS.map((h) => h.key);
  assert.deepEqual(helmEnum, expected);
  assert.deepEqual(HELM_STYLES, expected);
  assert.ok(helmEnum.includes('esquire') && helmEnum.includes('knight')); // sanity: real 5-variant set
});

test('achievement is not required at the top level (the backfill fills it in)', () => {
  assert.deepEqual(DESIGN_TOOL.input_schema.required, ['field', 'charges', 'rationale']);
});

// ── 2. resolveCharges — shield charges + crest + both supporters, unmatched
//    keys pass through untouched. ──────────────────────────────────────────

test('resolveCharges resolves shield charges, crest, and both supporters to catalog slugs', () => {
  const design = {
    field: { tincture: 'Argent' },
    charges: [
      { role: 'primary', number: 1, tincture: 'Sable', object: { kind: 'ordinary', key: 'fess' } },
      { role: 'secondary', number: 1, tincture: 'Or', object: { kind: 'charge', key: 'Oak Tree' } },
    ],
    achievement: {
      crest: { tincture: 'Or', object: { key: 'Griffin Rampant' } },
      supporters: {
        dexter: { tincture: 'Argent', object: { key: 'Unicorn Rampant' } },
        sinister: { tincture: 'Argent', object: { key: 'Unicorn Passant' } },
      },
    },
  };
  const out = resolveCharges(design);
  assert.equal(out.charges[0].object.key, 'fess'); // ordinary untouched
  assert.equal(out.charges[1].object.key, 'oak-tree');
  assert.equal(out.achievement.crest.object.key, 'griffin-rampant');
  assert.equal(out.achievement.supporters.dexter.object.key, 'unicorn-rampant');
  assert.equal(out.achievement.supporters.sinister.object.key, 'unicorn-passant');
});

test('resolveCharges leaves an unmatched charge term untouched', () => {
  const design = {
    field: { tincture: 'Or' },
    charges: [{ role: 'secondary', number: 1, tincture: 'Gules', object: { kind: 'charge', key: 'not a real charge at all' } }],
    achievement: { supporters: { dexter: { tincture: 'Or', object: { key: 'also not real' } } } },
  };
  const out = resolveCharges(design);
  assert.equal(out.charges[0].object.key, 'not a real charge at all');
  assert.equal(out.achievement.supporters.dexter.object.key, 'also not real');
});

test('resolveCharges tolerates a design with no achievement at all', () => {
  const design = { field: { tincture: 'Or' }, charges: [] };
  assert.deepEqual(resolveCharges(design), { field: { tincture: 'Or' }, charges: [] });
});

// ── 3. Backfill, exercised end-to-end through onRequestPost (Claude call
//    stubbed — see stubFetch above). ────────────────────────────────────────

test('onRequestPost backfills a full achievement when Claude omits it entirely', async () => {
  const toolInput = {
    field: { tincture: 'Gules' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'fess' } }],
    motto: 'Test motto',
    rationale: { field: 'f', ordinary: 'o', charges: 'c' },
  };
  stubFetch(toolInput);
  const res = await onRequestPost({ request: fakeRequest({ description: 'a knight of the realm', turnstileToken: 'tok' }), env: BASE_ENV });
  assert.equal(res.status, 200);
  const body = await res.json();
  const a = body.design.achievement;
  assert.ok(a, 'expected achievement to be backfilled');
  for (const part of ['crest', 'helm', 'torse', 'mantling', 'supporters']) {
    assert.ok(a[part], `expected achievement.${part} to be backfilled`);
  }
  assert.equal(a.helm.style, 'esquire');
});

test('onRequestPost keeps the parts Claude DID provide and backfills only the rest', async () => {
  const toolInput = {
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'ordinary', key: 'chevron' } }],
    achievement: { helm: { style: 'knight' } },
    motto: 'Test motto',
    rationale: { field: 'f', ordinary: 'o', charges: 'c' },
  };
  stubFetch(toolInput);
  const res = await onRequestPost({ request: fakeRequest({ description: 'a knight of the realm', turnstileToken: 'tok' }), env: BASE_ENV });
  const body = await res.json();
  const a = body.design.achievement;
  assert.equal(a.helm.style, 'knight'); // preserved, not overwritten by the 'esquire' default
  for (const part of ['crest', 'torse', 'mantling', 'supporters']) {
    assert.ok(a[part], `expected achievement.${part} to be backfilled`);
  }
});

test('onRequestPost resolves crest/supporter charge terms returned by Claude', async () => {
  const toolInput = {
    field: { tincture: 'Vert' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'bend' } }],
    achievement: {
      crest: { tincture: 'Or', object: { key: 'Oak Tree' } },
    },
    motto: 'Test motto',
    rationale: { field: 'f', ordinary: 'o', charges: 'c' },
  };
  stubFetch(toolInput);
  const res = await onRequestPost({ request: fakeRequest({ description: 'a forester', turnstileToken: 'tok' }), env: BASE_ENV });
  const body = await res.json();
  assert.equal(body.design.achievement.crest.object.key, 'oak-tree');
});

// ── 4. The existing gates stay untouched. ───────────────────────────────────

test('onRequestPost still 503s when ANTHROPIC_API_KEY is absent (never reaches Claude)', async () => {
  // The gate order is rate-limit → Turnstile → key check → validate → Claude
  // (unchanged by this task) — so Turnstile still runs before the key check;
  // only the Anthropic call itself must never happen.
  let calledAnthropic = false;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('turnstile')) return { ok: true, json: async () => ({ success: true }) };
    calledAnthropic = true;
    throw new Error('must not call the Anthropic API when the key is absent');
  };
  const res = await onRequestPost({
    request: fakeRequest({ description: 'x', turnstileToken: 'tok' }),
    env: { TURNSTILE_SECRET_KEY: 'ts-secret' },
  });
  assert.equal(res.status, 503);
  assert.equal(calledAnthropic, false);
});

test('onRequestPost never echoes the API key or the description on a design-less tool reply', async () => {
  stubFetch({}); // no `field` → treated as no_design
  const res = await onRequestPost({
    request: fakeRequest({ description: 'a very secret family story', turnstileToken: 'tok' }),
    env: BASE_ENV,
  });
  assert.equal(res.status, 502);
  const raw = JSON.stringify(await res.json());
  assert.equal(raw.includes(BASE_ENV.ANTHROPIC_API_KEY), false);
  assert.equal(raw.includes('a very secret family story'), false);
});

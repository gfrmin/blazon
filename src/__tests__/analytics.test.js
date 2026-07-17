import { test } from 'node:test';
import assert from 'node:assert/strict';

import { track, setSuperProps, _enqueue, _gateMode, _computeInitialSuperProps, _resetForTests } from '../analytics.js';

// This module's DNT/no-key gating (`mode`) is computed once at import time
// from real `navigator`/`import.meta.env` — under plain `node --test` there
// is no Vite env injection and no DOM, so `mode` is always 'no_key' here
// (never 'dnt', never 'enabled'). That's why the pure gating/queue/storage
// logic below is factored out and tested directly instead of through
// track()'s live branches — the PostHog-loading path itself (idle-scheduled
// dynamic import, actual init()/capture() calls, real DNT) needs a browser
// and is verified live instead (see task-7-report.md).

test('_gateMode: DNT wins regardless of key', () => {
  assert.equal(_gateMode({ dnt: true, hasKey: true }), 'dnt');
  assert.equal(_gateMode({ dnt: true, hasKey: false }), 'dnt');
});

test('_gateMode: no key (and no DNT) → no_key', () => {
  assert.equal(_gateMode({ dnt: false, hasKey: false }), 'no_key');
});

test('_gateMode: key present, no DNT → enabled', () => {
  assert.equal(_gateMode({ dnt: false, hasKey: true }), 'enabled');
});

test('_enqueue keeps items under the limit untouched', () => {
  const q = _enqueue(_enqueue([], 'a', 3), 'b', 3);
  assert.deepEqual(q, ['a', 'b']);
});

test('_enqueue drops the oldest item once over the limit (bounded)', () => {
  let q = [];
  for (let i = 0; i < 5; i++) q = _enqueue(q, i, 3);
  assert.deepEqual(q, [2, 3, 4]);
});

test('_enqueue does not mutate the input array', () => {
  const original = ['a'];
  const next = _enqueue(original, 'b', 5);
  assert.deepEqual(original, ['a']);
  assert.deepEqual(next, ['a', 'b']);
});

test('_computeInitialSuperProps: empty/missing storage → all defaults', () => {
  const fakeStorage = { getItem: () => null };
  assert.deepEqual(
    _computeInitialSuperProps({ localStorage: fakeStorage, sessionStorage: fakeStorage }),
    { has_library: false, designs_saved_count: 0, has_purchased: false, arrived_via_share: false }
  );
});

test('_computeInitialSuperProps: a populated library array sets has_library + count', () => {
  const ls = { getItem: (k) => (k === 'blazon:library:v1' ? JSON.stringify([{}, {}, {}]) : null) };
  const ss = { getItem: () => null };
  const props = _computeInitialSuperProps({ localStorage: ls, sessionStorage: ss });
  assert.equal(props.has_library, true);
  assert.equal(props.designs_saved_count, 3);
});

test('_computeInitialSuperProps: corrupt library JSON parses defensively to defaults, no throw', () => {
  const ls = { getItem: (k) => (k === 'blazon:library:v1' ? '{not json' : null) };
  const ss = { getItem: () => null };
  assert.doesNotThrow(() => {
    const props = _computeInitialSuperProps({ localStorage: ls, sessionStorage: ss });
    assert.equal(props.has_library, false);
    assert.equal(props.designs_saved_count, 0);
  });
});

test('_computeInitialSuperProps: blazon:unlocks presence (any value) → has_purchased', () => {
  const ls = { getItem: (k) => (k === 'blazon:unlocks' ? '1' : null) };
  const ss = { getItem: () => null };
  assert.equal(_computeInitialSuperProps({ localStorage: ls, sessionStorage: ss }).has_purchased, true);
});

test('_computeInitialSuperProps: sessionStorage arrived-via-share flag', () => {
  const ls = { getItem: () => null };
  const ss = { getItem: (k) => (k === 'blazon:arrived_via_share' ? '1' : null) };
  assert.equal(_computeInitialSuperProps({ localStorage: ls, sessionStorage: ss }).arrived_via_share, true);
});

test('_computeInitialSuperProps: a storage that throws on getItem still returns defaults', () => {
  const throwing = { getItem: () => { throw new Error('storage disabled'); } };
  assert.doesNotThrow(() => {
    const props = _computeInitialSuperProps({ localStorage: throwing, sessionStorage: throwing });
    assert.deepEqual(props, { has_library: false, designs_saved_count: 0, has_purchased: false, arrived_via_share: false });
  });
});

// track()/setSuperProps() themselves: under node --test `mode` is always
// 'no_key' (see header note), so both are no-ops here beyond an optional
// DEV console.debug (DEV is also false under plain node — no Vite define).
// This just confirms the no-key path never throws; the queueing/PostHog
// branches need `mode === 'enabled'`, which needs a browser build.
test('track() and setSuperProps() do not throw under the no-key gate', () => {
  assert.doesNotThrow(() => {
    track('generate_submitted', { desc_length: 42, used_preset: false });
    setSuperProps({ has_library: true });
  });
});

test('_resetForTests is callable repeatedly without throwing', () => {
  assert.doesNotThrow(() => { _resetForTests(); _resetForTests(); });
});

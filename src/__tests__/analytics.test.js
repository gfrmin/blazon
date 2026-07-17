import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  track, setSuperProps, _enqueue, _gateMode, _computeInitialSuperProps, _resetForTests,
  _sanitizePathname, _sanitizeUrl, _sanitizeReferrer, _sanitizeEventForPostHog,
} from '../analytics.js';

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

// ── before_send sanitization (Finding 1, review round 1) — pure, so fully
//    unit-testable without a browser. Live network-capture evidence for the
//    end-to-end wiring (ph.init's before_send hook actually being called)
//    lives in task-7-report.md, same split as the rest of this file. ──

test('_sanitizePathname: /a/<payload> collapses to /a', () => {
  assert.equal(_sanitizePathname('/a/cSomeEncodedCoatPayloadWithAMottoInIt'), '/a');
});

test('_sanitizePathname: /studio passes through unchanged', () => {
  assert.equal(_sanitizePathname('/studio'), '/studio');
});

test('_sanitizePathname: any other pathname passes through unchanged', () => {
  assert.equal(_sanitizePathname('/'), '/');
  assert.equal(_sanitizePathname('/library'), '/library');
});

test('_sanitizePathname: non-string input passes through untouched (no throw)', () => {
  assert.equal(_sanitizePathname(undefined), undefined);
  assert.equal(_sanitizePathname(null), null);
});

test('_sanitizeUrl: strips hash (Studio autosave carries the motto there)', () => {
  assert.equal(_sanitizeUrl('https://blazon.example/studio#cEncodedCoatWithMottoText'), 'https://blazon.example/studio');
});

test('_sanitizeUrl: strips query (?desc= carries free text)', () => {
  assert.equal(_sanitizeUrl('https://blazon.example/studio?desc=My%20grandmother%20was...'), 'https://blazon.example/studio');
});

test('_sanitizeUrl: collapses an /a/<payload> pathname AND still strips any hash/query on it', () => {
  assert.equal(_sanitizeUrl('https://blazon.example/a/cPayload?x=1#y'), 'https://blazon.example/a');
});

test('_sanitizeUrl: unparseable input returns undefined (caller drops the property)', () => {
  assert.equal(_sanitizeUrl('not a url'), undefined);
  assert.equal(_sanitizeUrl(undefined), undefined);
  assert.equal(_sanitizeUrl(42), undefined);
});

test('_sanitizeReferrer: same-origin referrer is dropped (it may itself carry a hash/payload)', () => {
  assert.equal(_sanitizeReferrer('https://blazon.example/studio#cSecretMotto', 'https://blazon.example'), undefined);
});

test('_sanitizeReferrer: external referrer passes through unchanged', () => {
  assert.equal(_sanitizeReferrer('https://www.google.com/', 'https://blazon.example'), 'https://www.google.com/');
});

test('_sanitizeReferrer: posthog-js\'s "$direct" sentinel (not a URL) passes through unchanged', () => {
  assert.equal(_sanitizeReferrer('$direct', 'https://blazon.example'), '$direct');
});

test('_sanitizeReferrer: empty/falsy referrer passes through unchanged', () => {
  assert.equal(_sanitizeReferrer('', 'https://blazon.example'), '');
  assert.equal(_sanitizeReferrer(undefined, 'https://blazon.example'), undefined);
});

test('_sanitizeEventForPostHog: strips motto/desc/payload from every current/initial/session_entry URL property, in one event', () => {
  const origin = 'https://blazon.example';
  const event = {
    uuid: 'u1',
    event: '$pageview',
    properties: {
      $current_url: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
      $initial_current_url: 'https://blazon.example/a/cSHARED_PAYLOAD_STRING?desc=grandmother+story',
      $session_entry_url: 'https://blazon.example/studio?desc=grandmother+story',
      $pathname: '/a/cSHARED_PAYLOAD_STRING',
      $initial_pathname: '/studio',
      $session_entry_pathname: '/a/cANOTHER_PAYLOAD',
      $referrer: 'https://blazon.example/a/cSHARED_PAYLOAD_STRING',
      $initial_referrer: 'https://www.google.com/search?q=coat+of+arms',
      $session_entry_referrer: '$direct',
      $host: 'blazon.example',
      $prev_pageview_pathname: '/a/cPREVIOUS_PAGE_PAYLOAD', // caught live: raw prev-page pathname
      desc_length: 152, // an ordinary hand-written prop — must survive untouched
    },
  };
  const clean = _sanitizeEventForPostHog(event, origin);
  const dump = JSON.stringify(clean);

  // The actual deliverable: no free text / payload substrings anywhere.
  assert.ok(!dump.includes('MOTTO'), dump);
  assert.ok(!dump.includes('PAYLOAD'), dump);
  assert.ok(!dump.includes('grandmother'), dump);
  assert.ok(!dump.includes('#'), dump); // no hash survives anywhere
  assert.ok(!dump.includes('desc='), dump); // no query survives anywhere

  assert.deepEqual(clean.properties, {
    $current_url: 'https://blazon.example/studio',
    $initial_current_url: 'https://blazon.example/a',
    $session_entry_url: 'https://blazon.example/studio',
    $pathname: '/a',
    $initial_pathname: '/studio',
    $session_entry_pathname: '/a',
    $initial_referrer: 'https://www.google.com/search?q=coat+of+arms', // external — kept
    $session_entry_referrer: '$direct', // not a URL — kept
    $host: 'blazon.example', // untouched — never carries payload/free text
    $prev_pageview_pathname: '/a', // collapsed same as $pathname
    desc_length: 152, // untouched
    // $referrer: dropped entirely — it was same-origin
  });
  assert.ok(!('$referrer' in clean.properties));
});

test('_sanitizeEventForPostHog: does not mutate the input event/properties objects', () => {
  const original = { event: '$pageview', properties: { $current_url: 'https://blazon.example/studio#x' } };
  const snapshotProps = { ...original.properties };
  _sanitizeEventForPostHog(original, 'https://blazon.example');
  assert.deepEqual(original.properties, snapshotProps);
});

test('_sanitizeEventForPostHog: events with no properties (or null) pass through untouched, no throw', () => {
  assert.doesNotThrow(() => {
    assert.equal(_sanitizeEventForPostHog(null, 'https://blazon.example'), null);
    const noProps = { event: '$identify' };
    assert.equal(_sanitizeEventForPostHog(noProps, 'https://blazon.example'), noProps);
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

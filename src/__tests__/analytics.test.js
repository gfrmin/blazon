import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  track, setSuperProps, _enqueue, _gateMode, _computeInitialSuperProps, _resetForTests,
  _sanitizePathname, _sanitizeUrl, _sanitizeReferrer,
  _sanitizeExceptionFrameFilename, _sanitizeExceptionList, _sanitizeProps,
  sanitizeEvent, SAFE_PROPS, _sanitizeFailureCount,
  _sanitizedInitialPersonInfo, _sanitizeUnset, INITIAL_PERSON_INFO_KEY,
} from '../analytics.js';

const ORIGIN = 'https://blazon.example';

// Standard posthog-js-computed properties present on (virtually) every real
// captured event, regardless of event name — sourced from
// node_modules/posthog-js/lib/src/utils/event-utils.js's getEventProperties/
// getPersonInfo and posthog-core.js's calculateEventProperties, cross-checked
// against a live capture (see task-7-report.md's "Hardening" section for the
// network-level evidence). Spread into each representative event below and
// overridden per-test so every whole-payload assertion stays realistic
// without 40 duplicated lines per test.
function basePostHogProps(overrides = {}) {
  return {
    token: 'phc_faketestkey000000000000000000000000',
    distinct_id: '0198abc-device-0000-0000-000000000000',
    $device_id: '0198abc-device-0000-0000-000000000000',
    $session_id: '0198abc-session-000-0000-000000000000',
    $window_id: '0198abc-window-0000-0000-000000000000',
    $groups: {},
    $is_identified: false,
    $process_person_profile: false,
    $lib: 'web',
    $lib_version: '1.404.0',
    $insert_id: 'a1b2c3d4',
    $time: 1783000000.123,
    $os: 'Linux',
    $os_version: '',
    $browser: 'Chrome',
    $browser_version: 128,
    $browser_language: 'en-US',
    $browser_language_prefix: 'en',
    $device: '',
    $device_type: 'Desktop',
    $screen_height: 1080,
    $screen_width: 1920,
    $viewport_height: 963,
    $viewport_width: 1920,
    $raw_user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    $timezone: 'Etc/UTC',
    $timezone_offset: 0,
    $host: 'blazon.example',
    $referring_domain: '$direct',
    // dangerous/unwanted internals — deliberately included in the RAW input
    // to prove the allowlist drops them, not just that it keeps the good stuff
    title: 'Blazon — Design a coat of arms',
    utm_source: null,
    gclid: null,
    $search_engine: null,
    $config_defaults: '2026-06-25',
    $sdk_debug_retry_queue_size: 0,
    ...overrides,
  };
}

function safePostHogProps(overrides = {}) {
  return {
    token: 'phc_faketestkey000000000000000000000000',
    distinct_id: '0198abc-device-0000-0000-000000000000',
    $device_id: '0198abc-device-0000-0000-000000000000',
    $session_id: '0198abc-session-000-0000-000000000000',
    $window_id: '0198abc-window-0000-0000-000000000000',
    $groups: {},
    $is_identified: false,
    $process_person_profile: false,
    $lib: 'web',
    $lib_version: '1.404.0',
    $insert_id: 'a1b2c3d4',
    $time: 1783000000.123,
    $os: 'Linux',
    $os_version: '',
    $browser: 'Chrome',
    $browser_version: 128,
    $browser_language: 'en-US',
    $browser_language_prefix: 'en',
    $device: '',
    $device_type: 'Desktop',
    $screen_height: 1080,
    $screen_width: 1920,
    $viewport_height: 963,
    $viewport_width: 1920,
    $raw_user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    $timezone: 'Etc/UTC',
    $timezone_offset: 0,
    $host: 'blazon.example',
    $referring_domain: '$direct',
    ...overrides,
  };
}

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

// ── $initial_person_info pre-seed (review round 2 — closes the /flags leak) ──

test('_sanitizedInitialPersonInfo: motto-bearing hash + query stripped from u, /a/<payload> path collapsed', () => {
  assert.deepEqual(
    _sanitizedInitialPersonInfo('https://blazon.example/a/cPAYLOAD_WITH_MOTTO?desc=secret#cMOTTO_HASH', '', ORIGIN),
    { r: '$direct', u: 'https://blazon.example/a' }
  );
});

test('_sanitizedInitialPersonInfo: studio autosave hash stripped, pathname untouched', () => {
  const info = _sanitizedInitialPersonInfo('https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA', '$direct', ORIGIN);
  assert.deepEqual(info, { r: '$direct', u: 'https://blazon.example/studio' });
  assert.ok(!JSON.stringify(info).includes('MOTTO'));
});

test('_sanitizedInitialPersonInfo: same-origin referrer (itself potentially a motto-bearing URL) becomes $direct', () => {
  const info = _sanitizedInitialPersonInfo(
    'https://blazon.example/studio',
    'https://blazon.example/studio#cPREVIOUS_MOTTO',
    ORIGIN
  );
  assert.equal(info.r, '$direct');
});

test('_sanitizedInitialPersonInfo: external referrer passes through unchanged', () => {
  const info = _sanitizedInitialPersonInfo('https://blazon.example/studio', 'https://www.google.com/', ORIGIN);
  assert.equal(info.r, 'https://www.google.com/');
});

test('_sanitizedInitialPersonInfo: empty/missing referrer falls back to $direct (matches posthog-js\'s own getReferrer())', () => {
  assert.equal(_sanitizedInitialPersonInfo('https://blazon.example/', '', ORIGIN).r, '$direct');
  assert.equal(_sanitizedInitialPersonInfo('https://blazon.example/', undefined, ORIGIN).r, '$direct');
});

test('_sanitizedInitialPersonInfo: unparseable href omits `u` entirely rather than a raw passthrough', () => {
  const info = _sanitizedInitialPersonInfo('not a url', '$direct', ORIGIN);
  assert.deepEqual(info, { r: '$direct' });
  assert.ok(!('u' in info));
});

// ── exception-list frame filename sanitization ──────────────────────────

test('_sanitizeExceptionFrameFilename: sanitizes a filename that happens to equal the live motto-hash URL', () => {
  assert.equal(
    _sanitizeExceptionFrameFilename('https://blazon.example/studio#cMOTTO_PER_ARDUA'),
    'https://blazon.example/studio'
  );
});

test('_sanitizeExceptionFrameFilename: an ordinary asset URL passes through unchanged (nothing to strip)', () => {
  assert.equal(
    _sanitizeExceptionFrameFilename('https://blazon.example/assets/index-C6Z84Xhg.js'),
    'https://blazon.example/assets/index-C6Z84Xhg.js'
  );
});

test('_sanitizeExceptionFrameFilename: non-URL-shaped filenames (webpack://, <anonymous>) pass through, not dropped', () => {
  assert.equal(_sanitizeExceptionFrameFilename('<anonymous>'), '<anonymous>');
  assert.equal(_sanitizeExceptionFrameFilename('webpack-internal:///./src/Studio.jsx'), 'webpack-internal:///./src/Studio.jsx');
});

test('_sanitizeExceptionList: sanitizes only the filename field of every frame, leaves the rest untouched', () => {
  const list = [
    {
      type: 'TypeError',
      value: "Cannot read properties of undefined (reading 'coat')",
      mechanism: { type: 'onerror', handled: false, synthetic: false },
      stacktrace: {
        type: 'raw',
        frames: [
          { filename: 'https://blazon.example/assets/index-C6Z84Xhg.js', function: 'apply', lineno: 42, colno: 17, in_app: true },
          { filename: 'https://blazon.example/studio#cMOTTO_PER_ARDUA', function: '<anonymous>', lineno: 1, colno: 1, in_app: true },
        ],
      },
    },
  ];
  assert.deepEqual(_sanitizeExceptionList(list), [
    {
      type: 'TypeError',
      value: "Cannot read properties of undefined (reading 'coat')",
      mechanism: { type: 'onerror', handled: false, synthetic: false },
      stacktrace: {
        type: 'raw',
        frames: [
          { filename: 'https://blazon.example/assets/index-C6Z84Xhg.js', function: 'apply', lineno: 42, colno: 17, in_app: true },
          { filename: 'https://blazon.example/studio', function: '<anonymous>', lineno: 1, colno: 1, in_app: true },
        ],
      },
    },
  ]);
});

test('_sanitizeExceptionList: a malformed (non-array) shape is dropped, not passed through raw', () => {
  assert.equal(_sanitizeExceptionList('not an array'), undefined);
  assert.equal(_sanitizeExceptionList(undefined), undefined);
});

// ── _sanitizeProps / sanitizeEvent — allowlist inversion (Hardening) ─────
//
// The previous fix (review round 1) was a DENYLIST of nine named
// URL-derived properties — proven leaky by its own construction, since
// $prev_pageview_pathname was found only by reading posthog-js source after
// the finding had already named six. Everything below tests the allowlist
// that replaced it: `SAFE_PROPS` names every property this app wants; every
// other property is dropped, not rewritten, by construction — including
// ones nobody has thought to name yet (see the "novel property" test).
//
// Every test in this section asserts against a fully explicit expected
// object (`assert.deepEqual` on the WHOLE properties bag, not a substring
// grep) — per the brief: "prove the negative with whole-payload equality,
// not substring greps: greps only catch fields you thought to look for."

test('_sanitizeProps: a flat properties bag — safe keys survive, special keys are rewritten, unknown keys dropped', () => {
  assert.deepEqual(
    _sanitizeProps({
      desc_length: 42,
      token: 't1',
      $current_url: 'https://blazon.example/studio#cMOTTO',
      $referrer: 'https://blazon.example/a/cPAYLOAD',
      totally_unheard_of_prop: 'nope',
    }, ORIGIN),
    { desc_length: 42, token: 't1', $current_url: 'https://blazon.example/studio' }
  );
});

test('sanitizeEvent: $pageview from a motto-bearing /studio#<payload> URL — whole-payload equality', () => {
  const raw = {
    uuid: 'u1',
    event: '$pageview',
    timestamp: '2026-07-16T12:00:00.000Z',
    properties: basePostHogProps({
      $current_url: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
      $initial_current_url: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
      $session_entry_url: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
      $pathname: '/studio',
      $initial_pathname: '/studio',
      $session_entry_pathname: '/studio',
      $referrer: '$direct',
      $initial_referrer: '$direct',
      $session_entry_referrer: '$direct',
      $initial_host: 'blazon.example',
      $session_entry_host: 'blazon.example',
      $initial_referring_domain: '$direct',
      $session_entry_referring_domain: '$direct',
    }),
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  const dump = JSON.stringify(clean);
  assert.ok(!dump.includes('MOTTO'), dump);
  assert.ok(!dump.includes('#'), dump);

  assert.deepEqual(clean, {
    uuid: 'u1',
    event: '$pageview',
    timestamp: '2026-07-16T12:00:00.000Z',
    properties: safePostHogProps({
      $current_url: 'https://blazon.example/studio',
      $initial_current_url: 'https://blazon.example/studio',
      $session_entry_url: 'https://blazon.example/studio',
      $pathname: '/studio',
      $initial_pathname: '/studio',
      $session_entry_pathname: '/studio',
      $referrer: '$direct',
      $initial_referrer: '$direct',
      $session_entry_referrer: '$direct',
      $initial_host: 'blazon.example',
      $session_entry_host: 'blazon.example',
      $initial_referring_domain: '$direct',
      $session_entry_referring_domain: '$direct',
    }),
  });
});

test('sanitizeEvent: download_free — own event prop survives, everything unnamed is dropped', () => {
  const raw = {
    uuid: 'u2',
    event: 'download_free',
    timestamp: '2026-07-16T12:05:00.000Z',
    properties: basePostHogProps({
      format: 'png',
      has_library: true,
      designs_saved_count: 2,
      has_purchased: false,
      arrived_via_share: false,
      $current_url: 'https://blazon.example/studio',
      $pathname: '/studio',
      $referrer: 'https://www.google.com/',
      // a plausible future/unnamed internal — must not survive
      $some_new_internal_flag: true,
    }),
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.deepEqual(clean.properties, safePostHogProps({
    format: 'png',
    has_library: true,
    designs_saved_count: 2,
    has_purchased: false,
    arrived_via_share: false,
    $current_url: 'https://blazon.example/studio',
    $pathname: '/studio',
    $referrer: 'https://www.google.com/', // external — kept
  }));
});

test('sanitizeEvent: $exception — sanitizes both the standard URL props AND $exception_list frame filenames', () => {
  const raw = {
    uuid: 'u3',
    event: '$exception',
    timestamp: '2026-07-16T12:10:00.000Z',
    properties: basePostHogProps({
      $current_url: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
      $pathname: '/studio',
      $referrer: '$direct',
      $exception_level: 'error',
      $exception_list: [
        {
          type: 'TypeError',
          value: "Cannot read properties of undefined (reading 'coat')",
          mechanism: { type: 'onerror', handled: false, synthetic: false },
          stacktrace: {
            type: 'raw',
            frames: [
              { filename: 'https://blazon.example/assets/index-C6Z84Xhg.js', function: 'apply', lineno: 42, colno: 17, in_app: true },
              // a worst-case synthetic frame carrying the live page hash —
              // proves filename sanitization, not just $current_url's.
              { filename: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA', function: '<anonymous>', lineno: 1, colno: 1, in_app: true },
            ],
          },
        },
      ],
    }),
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  const dump = JSON.stringify(clean);
  assert.ok(!dump.includes('MOTTO'), dump);

  assert.deepEqual(clean.properties, safePostHogProps({
    $current_url: 'https://blazon.example/studio',
    $pathname: '/studio',
    $referrer: '$direct',
    $exception_level: 'error',
    $exception_list: [
      {
        type: 'TypeError',
        value: "Cannot read properties of undefined (reading 'coat')",
        mechanism: { type: 'onerror', handled: false, synthetic: false },
        stacktrace: {
          type: 'raw',
          frames: [
            { filename: 'https://blazon.example/assets/index-C6Z84Xhg.js', function: 'apply', lineno: 42, colno: 17, in_app: true },
            { filename: 'https://blazon.example/studio', function: '<anonymous>', lineno: 1, colno: 1, in_app: true },
          ],
        },
      },
    ],
  }));
});

test('sanitizeEvent: entry $pageview at /studio?desc=<free text> — query text never survives', () => {
  const raw = {
    uuid: 'u4',
    event: '$pageview',
    timestamp: '2026-07-16T12:15:00.000Z',
    properties: basePostHogProps({
      $current_url: 'https://blazon.example/studio?desc=My%20grandmother%20was%20an%20astronomer',
      $initial_current_url: 'https://blazon.example/studio?desc=My%20grandmother%20was%20an%20astronomer',
      $pathname: '/studio',
      $initial_pathname: '/studio',
      $referrer: '$direct',
    }),
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  const dump = JSON.stringify(clean);
  assert.ok(!dump.includes('grandmother'), dump);
  assert.ok(!dump.includes('desc='), dump);

  assert.deepEqual(clean.properties, safePostHogProps({
    $current_url: 'https://blazon.example/studio',
    $initial_current_url: 'https://blazon.example/studio',
    $pathname: '/studio',
    $initial_pathname: '/studio',
    $referrer: '$direct',
  }));
});

test('sanitizeEvent: /a/<payload> share pageview — pathname collapses, same-origin referrer dropped', () => {
  const raw = {
    uuid: 'u5',
    event: '$pageview',
    timestamp: '2026-07-16T12:20:00.000Z',
    properties: basePostHogProps({
      arrived_via_share: true,
      $current_url: 'https://blazon.example/a/cSHARED_PAYLOAD_STRING',
      $pathname: '/a/cSHARED_PAYLOAD_STRING',
      $prev_pageview_pathname: '/a/cPREVIOUS_PAGE_PAYLOAD',
      // the referrer is our OWN previous motto-bearing page — must be dropped
      $referrer: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA',
    }),
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  const dump = JSON.stringify(clean);
  assert.ok(!dump.includes('PAYLOAD'), dump);
  assert.ok(!dump.includes('MOTTO'), dump);

  assert.deepEqual(clean.properties, safePostHogProps({
    arrived_via_share: true,
    $current_url: 'https://blazon.example/a',
    $pathname: '/a',
    $prev_pageview_pathname: '/a',
    // $referrer: dropped — same-origin
  }));
  assert.ok(!('$referrer' in clean.properties));
});

// ── the point of this task: novel/unnamed properties are dropped by construction ──

test('drops unknown properties even when they carry the motto', () => {
  const raw = {
    event: '$pageview',
    properties: {
      token: 'phc_faketestkey000000000000000000000000', // safe — kept, for contrast
      // an invented property no one has named yet, shaped exactly like the
      // kind of thing a future posthog-js version could add unannounced:
      $some_future_url_prop: 'https://blazon.example/studio#cMOTTO_PER_ARDUA_AD_ASTRA_FUTURE_LEAK',
      $another_new_posthog_internal: 'anything at all',
    },
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.deepEqual(clean.properties, { token: 'phc_faketestkey000000000000000000000000' });
  assert.ok(!JSON.stringify(clean).includes('MOTTO'));
  assert.ok(!('$some_future_url_prop' in clean.properties));
  assert.ok(!('$another_new_posthog_internal' in clean.properties));
});

test('both polarities: a sanitizer that dropped everything would fail this — safe props positively survive', () => {
  const raw = {
    event: 'generate_result',
    properties: {
      outcome: 'ai',
      latency_ms: 1234,
      token: 'phc_x',
      distinct_id: 'd1',
      $session_id: 's1',
      unnamed_junk: 'drop me',
    },
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  // Every safe key is individually present and correctly valued — a
  // "drop everything" implementation fails every one of these.
  assert.equal(clean.properties.outcome, 'ai');
  assert.equal(clean.properties.latency_ms, 1234);
  assert.equal(clean.properties.token, 'phc_x');
  assert.equal(clean.properties.distinct_id, 'd1');
  assert.equal(clean.properties.$session_id, 's1');
  // ...and the one unnamed key does not.
  assert.ok(!('unnamed_junk' in clean.properties));
});

test('sanitizeEvent: also sanitizes $set_once (posthog can attach $initial_* URL props there too, independent of properties)', () => {
  // posthog-core.js's _calculate_set_once_properties populates data.$set_once
  // from persistence.get_initial_props() whenever person processing is
  // active — the same $initial_current_url/$initial_pathname/$initial_referrer
  // family that lives in `properties`, but on a SEPARATE top-level field the
  // original review-round-1 fix never touched. This app doesn't call
  // identify() today (so $set_once is unpopulated in practice — see
  // task-7-report.md), but the allowlist covers it defensively regardless.
  const raw = {
    event: '$identify',
    properties: { token: 'phc_x', $lib: 'web' },
    $set_once: {
      $initial_current_url: 'https://blazon.example/studio#cSECRET_MOTTO',
      $initial_pathname: '/studio',
      $initial_referrer: '$direct',
      mystery_prop: 'should not survive',
    },
  };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.deepEqual(clean.$set_once, {
    $initial_current_url: 'https://blazon.example/studio',
    $initial_pathname: '/studio',
    $initial_referrer: '$direct',
  });
  assert.ok(!JSON.stringify(clean).includes('SECRET_MOTTO'));
});

// ── $unset (Minor, review round 2): array of property NAMES, not a bag ──

test('_sanitizeUnset: keeps only allowlisted/special names, drops the rest', () => {
  assert.deepEqual(
    _sanitizeUnset(['desc_length', 'token', '$current_url', 'totally_unheard_of_prop']),
    ['desc_length', 'token', '$current_url']
  );
});

test('_sanitizeUnset: a malformed (non-array) shape is dropped, not passed through raw', () => {
  assert.equal(_sanitizeUnset('not an array'), undefined);
  assert.equal(_sanitizeUnset(undefined), undefined);
  assert.equal(_sanitizeUnset({ desc_length: true }), undefined);
});

test('_sanitizeUnset: non-string array entries are dropped too', () => {
  assert.deepEqual(_sanitizeUnset(['token', 42, null, 'desc_length']), ['token', 'desc_length']);
});

test('sanitizeEvent: $unset — safe names survive, unnamed names dropped', () => {
  const raw = { event: '$identify', properties: { token: 't1' }, $unset: ['desc_length', 'unnamed_junk', '$referrer'] };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.deepEqual(clean.$unset, ['desc_length', '$referrer']);
});

test('sanitizeEvent: a malformed $unset is dropped entirely, not spread through raw', () => {
  const raw = { event: '$identify', properties: { token: 't1' }, $unset: 'not-an-array' };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.ok(!('$unset' in clean));
});

test('sanitizeEvent: no $unset field at all is simply absent from the output', () => {
  const raw = { event: '$identify', properties: { token: 't1' } };
  const clean = sanitizeEvent(raw, ORIGIN);
  assert.ok(!('$unset' in clean));
});

test('sanitizeEvent: does not mutate the input event/properties objects', () => {
  const original = { event: '$pageview', properties: { $current_url: 'https://blazon.example/studio#x', token: 't1' } };
  const snapshotProps = { ...original.properties };
  sanitizeEvent(original, ORIGIN);
  assert.deepEqual(original.properties, snapshotProps);
});

test('sanitizeEvent: events with no properties (or null) pass through untouched, no throw', () => {
  assert.doesNotThrow(() => {
    assert.equal(sanitizeEvent(null, ORIGIN), null);
    const noProps = { event: '$identify' };
    assert.deepEqual(sanitizeEvent(noProps, ORIGIN), noProps);
  });
});

// ── fail-closed: sanitization throwing drops the WHOLE event, never passes it through raw ──

test('fail-closed: a property whose getter throws drops the whole event, not a partial passthrough', () => {
  const before = _sanitizeFailureCount();
  const evilProps = {};
  Object.defineProperty(evilProps, 'desc_length', {
    enumerable: true,
    get() { throw new Error('boom — simulated hostile/broken getter'); },
  });
  const event = { event: '$pageview', properties: evilProps };
  assert.equal(sanitizeEvent(event, ORIGIN), null);
  // The drop was counted (cheap in-memory counter, no I/O at drop time).
  assert.equal(_sanitizeFailureCount(), before + 1);
});

test('fail-closed: a throwing $set_once likewise drops the whole event', () => {
  const evilSetOnce = {};
  Object.defineProperty(evilSetOnce, '$initial_current_url', {
    enumerable: true,
    get() { throw new Error('boom'); },
  });
  const event = { event: '$identify', properties: { token: 't1' }, $set_once: evilSetOnce };
  assert.equal(sanitizeEvent(event, ORIGIN), null);
});

// ── SAFE_PROPS schema sanity ──────────────────────────────────────────────

test('SAFE_PROPS: never contains a raw URL/pathname/referrer key (those are rewritten, not allowlisted)', () => {
  for (const key of ['$current_url', '$initial_current_url', '$session_entry_url',
    '$pathname', '$initial_pathname', '$session_entry_pathname', '$prev_pageview_pathname',
    '$referrer', '$initial_referrer', '$session_entry_referrer']) {
    assert.ok(!SAFE_PROPS.has(key), `${key} should be handled by the URL/PATH/REFERRER rewrite, not plain-allowlisted`);
  }
});

test('SAFE_PROPS: contains every real own-event prop key used by track() call-sites in the app', () => {
  for (const key of ['source', 'desc_length', 'used_preset', 'outcome', 'latency_ms',
    'part', 'control', 'is_first_edit', 'ms_since_submit', 'query_len', 'hits',
    'picked', 'index', 'surface', 'format']) {
    assert.ok(SAFE_PROPS.has(key), `${key} should be in SAFE_PROPS`);
  }
});

// ── pre-seed pin: exercised against the REAL, installed posthog-js internals ──
//
// Everything above tests our own pure logic. These tests instead import the
// actual `posthog-js/lib/src/constants.js` and `posthog-js/lib/src/
// posthog-persistence.js` modules (both plain JS, no DOM required at import
// or at the specific methods exercised here — verified: PostHogPersistence
// is constructible and register()/register_once()/get_initial_props() all
// run under plain `node --test`, no jsdom) and run the REAL
// register()-then-register_once()-then-get_initial_props() round trip our
// `init()` pre-seed depends on. This is the "test that fails loudly if the
// key/shape changes in a future version" the brief asked for: if a future
// posthog-js renames INITIAL_PERSON_INFO, changes register_once's
// already-set skip condition, or reshapes what get_initial_props() derives
// from {r, u}, these tests fail here — not silently in production.
//
// (The raw/dirty side of the leak — i.e. what get_initial_props() would
// return WITHOUT the pre-seed — needs a real `location.href`/
// `document.referrer`, which don't exist under plain Node; that side is
// covered by the live Playwright drive in task-7-report.md instead, same
// split as the rest of this file's browser-dependent behavior.)

test('pre-seed pin: INITIAL_PERSON_INFO_KEY matches the actually-installed posthog-js constant', async () => {
  const { INITIAL_PERSON_INFO } = await import('posthog-js/lib/src/constants.js');
  assert.equal(
    INITIAL_PERSON_INFO_KEY,
    INITIAL_PERSON_INFO,
    'analytics.js\'s hardcoded key has drifted from posthog-js\'s own constants.js — update INITIAL_PERSON_INFO_KEY'
  );
});

test('pre-seed pin: PostHogPersistence still exposes register/register_once/get_initial_props/set_initial_person_info as functions', async () => {
  const { PostHogPersistence } = await import('posthog-js/lib/src/posthog-persistence.js');
  for (const method of ['register', 'register_once', 'get_initial_props', 'set_initial_person_info']) {
    assert.equal(
      typeof PostHogPersistence.prototype[method],
      'function',
      `posthog-js's PostHogPersistence.prototype.${method} is missing or no longer a function — the init() pre-seed relies on it`
    );
  }
});

test('pre-seed pin: a pre-seeded sanitized value survives the REAL set_initial_person_info() no-op and comes back clean via get_initial_props()', async () => {
  const { PostHogPersistence } = await import('posthog-js/lib/src/posthog-persistence.js');
  const persistence = new PostHogPersistence({
    token: 'pin-test-token',
    persistence: 'memory',
    persistence_name: '',
    disable_persistence: false,
    mask_personal_data_properties: false,
    custom_personal_data_properties: [],
    disable_capture_url_hashes: false,
  });

  // Exactly what init() does: pre-seed with OUR sanitized value, built from
  // a deliberately dirty/motto-bearing href, the same fixture shape used
  // throughout this file.
  const seed = _sanitizedInitialPersonInfo(
    'https://blazon.example/studio#cPRESEED_PIN_MOTTO_SECRET',
    'https://blazon.example/a/cPRESEED_PIN_PAYLOAD',
    ORIGIN
  );
  assert.ok(!JSON.stringify(seed).includes('PRESEED_PIN'), 'the seed itself must already be clean');
  persistence.register({ [INITIAL_PERSON_INFO_KEY]: seed });

  // Now call posthog-js's REAL internal method that would normally poison
  // this key from the live (dirty) location.href/document.referrer — under
  // plain Node those globals don't exist, so register_once's own
  // "already set" skip is what's actually under test here, using the exact
  // method init() relies on running after the pre-seed.
  persistence.set_initial_person_info();

  assert.deepEqual(
    persistence.props[INITIAL_PERSON_INFO_KEY],
    seed,
    'set_initial_person_info() overwrote the pre-seeded value — register_once\'s already-set skip no longer holds'
  );

  const initialProps = persistence.get_initial_props();
  assert.equal(initialProps.$initial_current_url, 'https://blazon.example/studio');
  assert.equal(initialProps.$initial_referrer, '$direct'); // same-origin referrer dropped to $direct
  const dump = JSON.stringify(initialProps);
  assert.ok(!dump.includes('PRESEED_PIN'), dump);
  assert.ok(!dump.includes('#'), dump);
});

test('pre-seed pin: after the pre-seed for a motto-bearing /studio#<hash> URL, the persisted $initial_person_info carries no hash/query/`/a/` payload', () => {
  const seed = _sanitizedInitialPersonInfo(
    'https://blazon.example/studio?desc=grandmother%20astronomer#cMOTTO_PER_ARDUA_AD_ASTRA',
    'https://blazon.example/a/cSHARE_PAYLOAD_MARKER',
    ORIGIN
  );
  const dump = JSON.stringify(seed);
  assert.ok(!dump.includes('#'), dump);           // no hash
  assert.ok(!dump.includes('desc='), dump);        // no query
  assert.ok(!dump.includes('grandmother'), dump);  // no free text
  assert.ok(!dump.includes('/a/'), dump);           // no uncollapsed share payload path
  assert.ok(!dump.includes('MOTTO'), dump);
  assert.ok(!dump.includes('SHARE_PAYLOAD_MARKER'), dump);
  assert.deepEqual(seed, { r: '$direct', u: 'https://blazon.example/studio' });
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

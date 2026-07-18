import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { onRequestGet } from '../[payload].js';
import { encodeCoat } from '../../../src/share/codec.js';
import { blazon } from '../../../src/model/blazon.js';
import { withDefaultAchievement } from '../../../src/heraldry.js';

// The REAL index.html — not a hand-rolled fixture — so a future change to
// its <head> structure that breaks the injection regexes shows up here,
// not just in production.
const INDEX_HTML = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8');

function fakeEnv() {
  return {
    ASSETS: {
      fetch: async () => new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html' } }),
    },
  };
}

const request = (path) => ({ url: `https://blazon.pages.dev${path}` });

test('valid payload: 200, OG tags carry the formal blazon + absolute og:image, short cache', async () => {
  const coat = withDefaultAchievement({
    field: { tincture: 'Azure' },
    charges: [{ role: 'primary', number: 1, tincture: 'Or', object: { kind: 'ordinary', key: 'chevron' } }],
  });
  const payload = await encodeCoat(coat);
  const res = await onRequestGet({ request: request(`/a/${payload}`), env: fakeEnv(), params: { payload } });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');

  const html = await res.text();
  const formal = blazon(coat, 'formal');

  assert.match(html, new RegExp(`<meta property="og:description" content="${escapeReg(formal)}" />`));
  assert.match(html, /<meta property="og:title" content="A coat of arms — Blazon" \/>/);
  assert.match(html, new RegExp(`<meta property="og:image" content="https://blazon\\.pages\\.dev/api/og/${escapeReg(payload)}" />`));
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="1200" \/>/);
  assert.match(html, new RegExp(`<meta property="og:url" content="https://blazon\\.pages\\.dev/a/${escapeReg(payload)}" />`));
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);

  // Only ever ONE of each tag — a duplicate would confuse crawlers.
  for (const attr of ['og:title', 'og:description', 'og:image"', 'og:url', 'og:image:width', 'og:image:height']) {
    const count = html.split(attr).length - 1;
    assert.equal(count, 1, `expected exactly one "${attr}" occurrence, saw ${count}`);
  }
});

test('motto present: og:title appends it; motto absent: og:title is the bare string', async () => {
  const withMotto = withDefaultAchievement({ field: { tincture: 'Gules' }, charges: [], motto: 'Fortis et Fidelis' });
  const p1 = await encodeCoat(withMotto);
  const res1 = await onRequestGet({ request: request(`/a/${p1}`), env: fakeEnv(), params: { payload: p1 } });
  const html1 = await res1.text();
  assert.match(html1, /<meta property="og:title" content="A coat of arms — Blazon: &quot;Fortis et Fidelis&quot;" \/>/);

  const noMotto = withDefaultAchievement({ field: { tincture: 'Gules' }, charges: [] });
  const p2 = await encodeCoat(noMotto);
  const res2 = await onRequestGet({ request: request(`/a/${p2}`), env: fakeEnv(), params: { payload: p2 } });
  const html2 = await res2.text();
  assert.match(html2, /<meta property="og:title" content="A coat of arms — Blazon" \/>/);
});

test('bad payload -> 302 redirect to /', async () => {
  const res = await onRequestGet({ request: request('/a/not-a-real-payload'), env: fakeEnv(), params: { payload: 'not-a-real-payload' } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://blazon.pages.dev/');
});

test('no PII: og:description is EXACTLY the formal blazon, and no ?desc=-style free text appears anywhere in the shell', async () => {
  const coat = withDefaultAchievement({
    field: { tincture: 'Vert' },
    charges: [{ role: 'primary', number: 1, tincture: 'Argent', object: { kind: 'charge', key: 'lion', attitude: 'rampant' } }],
  });
  const payload = await encodeCoat(coat);
  const res = await onRequestGet({ request: request(`/a/${payload}`), env: fakeEnv(), params: { payload } });
  const html = await res.text();

  const descMatch = html.match(/<meta property="og:description" content="([^"]*)" \/>/);
  assert.ok(descMatch);
  assert.equal(descMatch[1], blazon(coat, 'formal'));
  assert.equal(html.includes('?desc='), false);
  assert.equal(html.includes('desc='), false);
});

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

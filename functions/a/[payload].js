// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — GET /a/:payload
//
// The share-link route: decodes the payload (the SAME codec the client uses
// to build permalinks — src/share/codec.js), then serves the SPA shell with
// the OG/Twitter meta tags swapped for THIS design's own, so a link pasted
// into Slack/Twitter/iMessage/etc. unfurls with the real coat of arms (the
// og:image — see ../api/og/[payload].js) instead of the generic Blazon logo
// card in index.html. The human who opens the link boots the SPA at this
// same route (App.jsx's router maps /a/:payload to the presentation view —
// Task 18); this Function only rewrites the shell's <head>, never the body.
//
// Implementation choice — plain string replace, not HTMLRewriter: the brief
// offers either ("string-replace or a lightweight rewrite — HTMLRewriter is
// available in Workers"). HTMLRewriter is a Workers-only global with NO
// equivalent in plain Node (confirmed: `typeof HTMLRewriter === 'undefined'`
// under `node --test`, even on a current Node major) — an HTMLRewriter
// implementation could only be exercised in tests against a hand-rolled
// mock of the Workers API, not the real one. String replace runs identically
// under `node --test` and the real Pages Functions runtime, so the exact
// same code path is what's tested AND what's deployed. index.html is small,
// static, and fully controlled by this repo, so replacing whole `<meta …>`
// tags by attribute-name regex (order/whitespace/line-wrap agnostic — see
// index.html's own multi-line og:description tag) is safe and robust; every
// injected value goes through `escapeAttr` regardless (defence in depth,
// even though the actual values here — a derived blazon string, a same-
// codec-alphabet payload — can't structurally contain `<`/`"`/`&`).
//
// PRIVACY: og:description is the DERIVED formal blazon (`blazon(coat,
// 'formal')`) — never the free-text description the user typed to generate
// the design. That free text isn't even part of the Coat AST shape (grepped:
// no `description` field exists anywhere in src/model/*), so there is
// nothing to leak here even by accident — the payload structurally cannot
// carry it. og:title includes the motto (per this task's brief) — that's
// NOT a description leak: the motto is text the user wrote specifically to
// be read on the shield itself, already fully public in the rendered
// achievement image this very route points to.
// ─────────────────────────────────────────────────────────────────────────

import { decodeCoat } from '../../src/share/codec.js';
import { blazon } from '../../src/model/blazon.js';
import { OG_WIDTH, OG_HEIGHT } from '../_lib/ogImage.js';

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Replace an existing `<meta {attr}="{value}" content="…">` tag (attribute
// order/whitespace-agnostic — matches on `{attr}="{value}"` appearing
// anywhere inside the tag, so it doesn't matter whether `content` comes
// before or after, or whether the tag is spread across lines).
function replaceMeta(html, attr, value, newContent) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}="${value}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${value}" content="${escapeAttr(newContent)}" />`;
  return html.replace(re, tag);
}

export async function onRequestGet({ request, env, params }) {
  let coat;
  try {
    coat = await decodeCoat(params.payload);
  } catch {
    return Response.redirect(new URL('/', request.url), 302);
  }

  const origin = new URL(request.url).origin;
  const imageUrl = `${origin}/api/og/${params.payload}`;
  const pageUrl = new URL(request.url).toString();
  const motto = typeof coat.motto === 'string' ? coat.motto.trim() : '';
  const title = motto ? `A coat of arms — Blazon: "${motto}"` : 'A coat of arms — Blazon';
  const description = blazon(coat, 'formal');

  const shellRes = await env.ASSETS.fetch(new URL('/index.html', request.url));
  if (!shellRes.ok) return shellRes;

  let html = await shellRes.text();
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:image', imageUrl);
  html = replaceMeta(html, 'property', 'og:url', pageUrl);
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = html.replace(
    '</head>',
    `<meta property="og:image:width" content="${OG_WIDTH}" /><meta property="og:image:height" content="${OG_HEIGHT}" /></head>`,
  );

  // Short cache: the shell references hash-named build assets that change
  // every deploy — a long TTL would keep serving a shell that points at
  // assets no longer on disk.
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'public, max-age=300' },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — GET /api/health
//
// Presence-only status of server-side config, used by the deploy smoke check
// (see .github/workflows/deploy.yml) to catch a toxic half-config before it
// reaches users. Reports only booleans — never the secret values themselves.
// ─────────────────────────────────────────────────────────────────────────

import { json } from '../_lib/http.js';

export async function onRequestGet({ env }) {
  return json(
    {
      generate: !!env.ANTHROPIC_API_KEY,
      turnstile: !!env.TURNSTILE_SECRET_KEY,
      // Symmetric with checkout.js's fail-safe gate and verify-payment.js's own
      // 503 check — all three require this SAME set of vars. A session that
      // /api/checkout could create but /api/verify-payment could never
      // confirm (STRIPE_SECRET_KEY + STRIPE_PRICE_ID set, UNLOCK_SIGNING_SECRET
      // missing) must report checkout:false here, or the DownloadDialog shows
      // a live $19 button whose `?cs=` return leg always 503s — charged,
      // never unlocked.
      checkout: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.UNLOCK_SIGNING_SECRET),
    },
    200,
    { 'Cache-Control': 'no-store' },
  );
}

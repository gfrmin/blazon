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
      checkout: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID),
    },
    200,
    { 'Cache-Control': 'no-store' },
  );
}

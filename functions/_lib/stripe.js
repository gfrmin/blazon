// ─────────────────────────────────────────────────────────────────────────
// Stripe REST helper — zero-dep (house style, see functions/api/generate.js's
// raw `fetch` to the Anthropic API: no vendor SDK). Stripe's API is form-
// encoded (including nested/array params via bracket notation, e.g.
// `line_items[0][price]`) and authenticates via HTTP Basic auth with the
// secret key as the username and an empty password — never logged, never
// echoed in a response body.
// ─────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.stripe.com/v1';

const authHeader = (secretKey) => 'Basic ' + btoa(`${secretKey}:`);

/**
 * POST to the Stripe API with a form-encoded body.
 * @param {string} secretKey
 * @param {string} path            e.g. '/checkout/sessions'
 * @param {Array<[string,string]>} entries  pre-flattened [key, value] pairs —
 *   callers build Stripe's own bracket-notation keys themselves (e.g.
 *   `['line_items[0][price]', priceId]`), since the exact param shape varies
 *   per endpoint and Stripe has no single canonical flattening rule.
 * @returns {Promise<{ok: boolean, status: number, data: object|null}>}
 */
export async function stripePost(secretKey, path, entries) {
  const form = new URLSearchParams();
  for (const [k, v] of entries) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: authHeader(secretKey),
    },
    body: form,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/**
 * GET from the Stripe API (session retrieve, etc.).
 * @param {string} secretKey
 * @param {string} path
 * @returns {Promise<{ok: boolean, status: number, data: object|null}>}
 */
export async function stripeGet(secretKey, path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: authHeader(secretKey) },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

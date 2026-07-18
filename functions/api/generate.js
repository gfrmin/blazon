// ─────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Function — POST /api/generate
//
// Turns a free-text description into a validated Coat (spec §6.1) by calling
// Claude server-side (the API key never reaches the browser). The allowed
// heraldic vocabulary is imported from the model tables — the same single
// source of truth the renderer and validator use — and enum-locked in the tool
// schema so Claude can only return keys the app knows how to render/blazon.
//
// Setup: set ANTHROPIC_API_KEY on the Pages project, e.g.
//   npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=blazon
// Until then this returns 503 and the client falls back to canned presets.
// ─────────────────────────────────────────────────────────────────────────

import { TINCTURE_ORDER, FURS } from '../../src/model/tinctures.js';
import { CHARGES, ATTITUDES } from '../../src/model/charges.js';
import { withDefaultAchievement } from '../../src/model/achievement.js';
import { validateDesignShape } from '../../src/model/validate.js';
import { HELMETS as VENDORED_HELMETS } from '../../src/achievement-art/manifest.js';
import { LOCAL_DIVISIONS, LOCAL_ORDINARIES } from '../../src/render-capabilities.js';
import catalog from '../../src/charges/catalog.js';
import { json } from '../_lib/http.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { checkRates } from '../_lib/ratelimit.js';

const TINCTURES_ENUM = [...TINCTURE_ORDER, ...FURS, 'proper'];
const ATTITUDE_KEYS = Object.keys(ATTITUDES);
// Ordinaries only — Shield.jsx draws zero subordinaries locally today (see
// render-capabilities.js's canRenderLocally, `kind === 'subordinary'` always
// defers to DrawShield), so the generation vocabulary excludes subordinaries
// outright rather than promising a kind Claude could pick that never renders
// locally.
const ORDINARY_KEYS = LOCAL_ORDINARIES;
// Helm styles, derived from the actually-vendored achievement art (not
// hand-copied) — so if a helmet variant is ever added/removed from
// src/achievement-art/, this enum tracks it automatically.
const HELM_STYLES = VENDORED_HELMETS.map((h) => h.key);

// A supporter (dexter or sinister): same shape for both, so this is a factory
// (not a shared object literal) purely for readability at each call site.
const SUPPORTER_SCHEMA = () => ({
  type: 'object',
  properties: {
    tincture: { type: 'string', enum: TINCTURES_ENUM },
    object: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Lowercase, hyphenated charge key — usually a beast in a rampant attitude.' },
        attitude: { type: 'string', enum: ATTITUDE_KEYS },
      },
      required: ['key'],
    },
  },
  required: ['tincture', 'object'],
});

// Normalize a charge term to a catalog slug ("Oak Tree" → "oak-tree").
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

// Map a single charge object's key onto the ~2,100-charge R2 catalog where
// possible, so it renders natively; anything unmatched stays as-is and renders
// via the DrawShield fallback (which understands the blazon term). Ordinaries/
// subordinaries (an explicit `kind` other than 'charge') are left untouched —
// crest/supporter objects never carry `kind` (they're implicitly a charge), so
// only skip when `kind` is present and says otherwise.
function resolveChargeObject(o) {
  if (!o || (o.kind && o.kind !== 'charge')) return;
  if (catalog[o.key] || CHARGES[o.key]) return; // already a catalog or curated key
  const s = slug(o.key);
  if (catalog[s]) o.key = s;
}

// Walk every charge-bearing object in the design — shield charges, plus the
// achievement's crest and both supporters — and resolve each to a catalog
// slug where possible. Unmatched keys pass through untouched.
function resolveCharges(design) {
  for (const g of design.charges || []) resolveChargeObject(g.object);
  const a = design.achievement;
  if (a) {
    if (a.crest) resolveChargeObject(a.crest.object);
    if (a.supporters) {
      if (a.supporters.dexter) resolveChargeObject(a.supporters.dexter.object);
      if (a.supporters.sinister) resolveChargeObject(a.supporters.sinister.object);
    }
  }
  return design;
}

// Abuse limits (cost backstop). Tune freely — each Claude call costs money.
const PER_IP_PER_MIN = 5;
const PER_IP_PER_DAY = 40;
const GLOBAL_PER_DAY = 3000;
const MAX_DESCRIPTION = 2000;
const UPSTREAM_TIMEOUT_MS = 30000;

// The rate-limit identity for an IP. IPv4 is used verbatim; IPv6 is aggregated
// to its /64 (the first four hextets) so an attacker holding a whole /64 — a
// routine allocation — can't cycle addresses to defeat the per-IP limit.
export function ipKey(ip) {
  if (!ip || !ip.includes(':')) return ip || 'unknown';
  const [head, tail = ''] = ip.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const fill = Math.max(0, 8 - headGroups.length - tailGroups.length);
  const groups = [...headGroups, ...Array(fill).fill('0'), ...tailGroups];
  return `${groups.slice(0, 4).join(':')}::/64`;
}

// The Coat shape, enum-constrained to the app's known vocabulary (spec §6.1).
const DESIGN_TOOL = {
  name: 'render_arms',
  description: 'Return the designed coat of arms as a structured Coat object.',
  input_schema: {
    type: 'object',
    properties: {
      field: {
        type: 'object',
        description: 'Either a single tincture, or a division. Only straight lines of partition render locally — do not describe a fancy (wavy/engrailed/…) line.',
        properties: {
          tincture: { type: 'string', enum: TINCTURES_ENUM },
          division: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: LOCAL_DIVISIONS },
              tinctures: { type: 'array', items: { type: 'string', enum: TINCTURES_ENUM }, minItems: 2, maxItems: 2 },
            },
            required: ['type', 'tinctures'],
          },
        },
      },
      charges: {
        type: 'array',
        description: 'Charge groups in heraldic precedence order (primary ordinary first, then secondary charges).',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['primary', 'secondary', 'tertiary', 'peripheral'] },
            number: { type: 'integer', minimum: 1, maximum: 6 },
            tincture: { type: 'string', enum: TINCTURES_ENUM },
            arrangement: { type: 'string' },
            object: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['ordinary', 'charge'] },
                key: {
                  type: 'string',
                  description: `Lowercase, hyphenated. For an ordinary use one of: ${ORDINARY_KEYS.join(', ')} (the only ones that render locally). For a charge, use any standard heraldic charge as a hyphenated term — e.g. lion-rampant, eagle, wolf, stag, griffin, oak-tree, escallop, anchor, rose, fleur-de-lys, sun-in-splendour, mullet, crescent, tower, sword, harp, garb, martlett. A library of ~2,000 charges is available; pick the most specific real heraldic charge.`,
                },
                attitude: { type: 'string', enum: ATTITUDE_KEYS },
              },
              required: ['kind', 'key'],
            },
          },
          required: ['role', 'number', 'tincture', 'object'],
        },
      },
      achievement: {
        type: 'object',
        description: 'Optional — the full achievement surrounding the shield (crest on a helm and torse, mantling, and supporters). Omit entirely for a shield-only design; any omitted part is filled in with a sensible default automatically.',
        properties: {
          crest: {
            type: 'object',
            description: 'The device standing on the torse above the helm. Reuses the shield-charge vocabulary; only renders if the chosen charge has vendored art (falls back to a lion rampant otherwise), so prefer a real heraldic beast or object.',
            properties: {
              tincture: { type: 'string', enum: TINCTURES_ENUM },
              object: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Lowercase, hyphenated charge key — same vocabulary as a shield charge.' },
                  attitude: { type: 'string', enum: ATTITUDE_KEYS },
                },
                required: ['key'],
              },
            },
            required: ['tincture', 'object'],
          },
          helm: {
            type: 'object',
            description: 'The helmet rank. Pick esquire unless the description clearly implies a title.',
            properties: {
              style: { type: 'string', enum: HELM_STYLES },
            },
            required: ['style'],
          },
          torse: {
            type: 'object',
            description: 'The twisted band of cloth atop the helm, as [metal, colour].',
            properties: {
              tinctures: { type: 'array', items: { type: 'string', enum: TINCTURES_ENUM }, minItems: 2, maxItems: 2 },
            },
            required: ['tinctures'],
          },
          mantling: {
            type: 'object',
            description: 'The cloth draped from the helm, as [colour, metal].',
            properties: {
              tinctures: { type: 'array', items: { type: 'string', enum: TINCTURES_ENUM }, minItems: 2, maxItems: 2 },
            },
            required: ['tinctures'],
          },
          supporters: {
            type: 'object',
            description: 'Figures flanking the shield. Omit sinister for a matched (mirrored) pair; omit supporters entirely if they add nothing to the story.',
            properties: {
              dexter: SUPPORTER_SCHEMA(),
              sinister: SUPPORTER_SCHEMA(),
            },
            required: ['dexter'],
          },
        },
      },
      motto: { type: 'string' },
      rationale: {
        type: 'object',
        description: 'Friendly, jargon-free one-liners shown beside the design. Only include crest/supporters/motto entries if you actually designed those achievement parts.',
        properties: {
          field: { type: 'string' },
          ordinary: { type: 'string' },
          charges: { type: 'string' },
          crest: { type: 'string' },
          supporters: { type: 'string' },
          motto: { type: 'string' },
        },
        required: ['field', 'ordinary', 'charges'],
      },
    },
    required: ['field', 'charges', 'rationale'],
    additionalProperties: false,
  },
};

const SYSTEM = `You are a herald designing an authentic coat of arms from a personal description.
Rules:
- Obey the tincture rule: never place a metal charge on a metal field, nor a colour on a colour (furs and "proper" are exempt). Choose tinctures that contrast.
- Pick tinctures, an ordinary (the primary structure), and at most one charge group that genuinely reflect the person — place, work, character, values.
- A large heraldic charge library (~2,000 charges) is available — choose the most fitting SPECIFIC charge (e.g. a stag for a hunter, a garb (wheatsheaf) for a farmer, an anchor for a sailor, a harp for Ireland, an oak-tree for endurance), not just a generic shape. Use lowercase hyphenated charge keys; for animals pick a posture variant (e.g. lion-rampant, lion-passant).
- Keep it simple and legible: one field (or one division), one ordinary, at most one charge group.
- You may also design the achievement around the shield: a crest on the helm/torse, mantling, and (only when the story genuinely calls for it) supporters. This is optional — omit the whole achievement, or any part of it, whenever it wouldn't add anything; a plain shield is a fine, complete answer.
- Write a short motto and a warm, jargon-free one-sentence rationale for each part you actually designed (field, ordinary, and charge always; crest/supporters/motto only if used).
Return everything via the render_arms tool.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const ip = ipKey(rawIp);

  // Rate limiting is a hard cost backstop — if the KV binding is missing we fail
  // CLOSED (never run generation uncapped) rather than silently disabling every
  // limit. Same "endpoint unavailable" posture the client already handles by
  // falling back to canned presets. (Contrast: a MISSING Turnstile secret is
  // also fatal below — both guards must be present for the endpoint to run.)
  if (!env.RATE) {
    console.error('generate: RATE KV binding missing — refusing to run uncapped');
    return json({ error: 'rate_unavailable' }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }

  // 1) Per-IP pre-filter (cheap KV reads) — bounds a single client BEFORE we
  //    spend a Turnstile verification on them. Keyed by /64 for IPv6.
  {
    const { ok } = await checkRates(env.RATE, [
      { baseKey: `ip:${ip}:min`, limit: PER_IP_PER_MIN, windowSec: 60 },
      { baseKey: `ip:${ip}:day`, limit: PER_IP_PER_DAY, windowSec: 86400 },
    ]);
    if (!ok) return json({ error: 'rate_limited' }, 429);
  }

  // 2) Turnstile — only real users reach the shared quota / Claude. Fail SAFE:
  //    if the secret isn't configured, lock the endpoint (never call Claude
  //    unprotected). Optional hostname allow-list via env.TURNSTILE_HOSTNAMES
  //    (comma-separated) rejects tokens solved on a foreign site.
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return json({ error: 'challenge_unavailable' }, 403);
  const allowedHostnames = (env.TURNSTILE_HOSTNAMES || '')
    .split(',').map((h) => h.trim()).filter(Boolean);
  if (!(await verifyTurnstile(body.turnstileToken, rawIp, secret, allowedHostnames))) {
    return json({ error: 'failed_challenge' }, 403);
  }

  // 3) Global daily cap — counted only AFTER Turnstile, so an unauthenticated
  //    attacker can't burn the shared quota without solving the challenge.
  {
    const { ok } = await checkRates(env.RATE, [
      { baseKey: 'global:day', limit: GLOBAL_PER_DAY, windowSec: 86400 },
    ]);
    if (!ok) return json({ error: 'rate_limited' }, 429);
  }

  // 4) Generation
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'generation_not_configured' }, 503);

  const description = (body.description || '').trim();
  if (!description) return json({ error: 'missing_description' }, 400);
  // Reject an over-long description explicitly rather than silently truncating
  // it (a truncated story generates arms for a person it no longer describes).
  if (description.length > MAX_DESCRIPTION) return json({ error: 'description_too_long' }, 400);

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      // Bound the upstream call so a hung Anthropic connection can't pin the
      // Function until the platform kills it (AbortSignal.timeout → the catch
      // below returns the same opaque 502 as any other fetch failure).
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM,
        tools: [DESIGN_TOOL],
        tool_choice: { type: 'tool', name: 'render_arms' },
        messages: [{ role: 'user', content: description }],
      }),
    });
  } catch {
    // Minor (final whole-branch review): never echo the caught error back to
    // the client — a generic opaque code only, same posture as
    // stripe.js/checkout.js's own error responses.
    return json({ error: 'upstream_unreachable' }, 502);
  }

  if (!upstream.ok) {
    // Same posture: don't return upstream.text() (could carry prompt/account
    // details from Anthropic's own error body) to the client.
    return json({ error: 'upstream_error' }, 502);
  }

  // Guard the JSON parse — a truncated/garbled upstream body must not throw an
  // unhandled error out of the Function.
  let data;
  try { data = await upstream.json(); } catch { return json({ error: 'upstream_error' }, 502); }

  // A reply cut off at the token ceiling carries a half-built tool input — the
  // JSON may parse but the design is incomplete. Reject it cleanly.
  if (data.stop_reason === 'max_tokens') return json({ error: 'design_truncated' }, 502);

  const tool = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'render_arms');
  if (!tool || !tool.input || !tool.input.field) return json({ error: 'no_design' }, 502);

  // Resolve charge terms to catalog slugs BEFORE backfilling, so a default
  // crest/supporters that echoes the coat's principal charge (see
  // withDefaultAchievement) sees the already-resolved key.
  const design = resolveCharges(tool.input);

  // Structurally validate the model's output before it flows into the backfill
  // and back to the client — defence in depth beyond the tool schema.
  if (validateDesignShape(design)) return json({ error: 'invalid_design' }, 502);

  // Backfill guarantees a full achievement even when Claude omits it (or parts).
  return json({ design: withDefaultAchievement(design) });
}

// Exported for tests only (schema enum-derivation checks, resolveCharges unit
// tests) — onRequestPost above is the only production entry point.
export { DESIGN_TOOL, resolveCharges, ORDINARY_KEYS, HELM_STYLES };

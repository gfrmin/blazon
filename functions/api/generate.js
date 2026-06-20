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
import { ORDINARIES } from '../../src/model/ordinaries.js';
import { SUBORDINARIES } from '../../src/model/ordinaries.js';
import { DIVISION_ORDER } from '../../src/model/field.js';
import { CHARGES, ATTITUDES } from '../../src/model/charges.js';
import { json } from '../_lib/http.js';
import { verifyTurnstile } from '../_lib/turnstile.js';
import { checkRates } from '../_lib/ratelimit.js';

const TINCTURES_ENUM = [...TINCTURE_ORDER, ...FURS, 'proper'];
const OBJECT_KEYS = [...Object.keys(ORDINARIES), ...Object.keys(SUBORDINARIES), ...Object.keys(CHARGES)];
const ATTITUDE_KEYS = Object.keys(ATTITUDES);

// Abuse limits (cost backstop). Tune freely — each Claude call costs money.
const PER_IP_PER_MIN = 5;
const PER_IP_PER_DAY = 40;
const GLOBAL_PER_DAY = 3000;

// The Coat shape, enum-constrained to the app's known vocabulary (spec §6.1).
const DESIGN_TOOL = {
  name: 'render_arms',
  description: 'Return the designed coat of arms as a structured Coat object.',
  input_schema: {
    type: 'object',
    properties: {
      field: {
        type: 'object',
        description: 'Either a single tincture, or a division.',
        properties: {
          tincture: { type: 'string', enum: TINCTURES_ENUM },
          division: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: DIVISION_ORDER },
              line: { type: 'string' },
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
                kind: { type: 'string', enum: ['ordinary', 'subordinary', 'charge'] },
                key: { type: 'string', enum: OBJECT_KEYS },
                attitude: { type: 'string', enum: ATTITUDE_KEYS },
              },
              required: ['kind', 'key'],
            },
          },
          required: ['role', 'number', 'tincture', 'object'],
        },
      },
      motto: { type: 'string' },
      rationale: {
        type: 'object',
        description: 'Friendly, jargon-free one-liners shown beside the design.',
        properties: {
          field: { type: 'string' },
          ordinary: { type: 'string' },
          charges: { type: 'string' },
        },
        required: ['field', 'ordinary', 'charges'],
      },
    },
    required: ['field', 'charges', 'rationale'],
  },
};

const SYSTEM = `You are a herald designing an authentic coat of arms from a personal description.
Rules:
- Obey the tincture rule: never place a metal charge on a metal field, nor a colour on a colour (furs and "proper" are exempt). Choose tinctures that contrast.
- Pick tinctures, an ordinary (the primary structure), and at most one charge group that genuinely reflect the person — place, work, character, values.
- Keep it simple and legible: one field (or one division), one ordinary, one charge group.
- Write a short motto and a warm, jargon-free one-sentence rationale for the field, the ordinary, and the charge.
Return everything via the render_arms tool.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }

  // 1) Rate-limit (cheap KV reads) — caps abuse spend even from real browsers.
  if (env.RATE) {
    const { ok } = await checkRates(env.RATE, [
      { baseKey: `ip:${ip}:min`, limit: PER_IP_PER_MIN, windowSec: 60 },
      { baseKey: `ip:${ip}:day`, limit: PER_IP_PER_DAY, windowSec: 86400 },
      { baseKey: 'global:day', limit: GLOBAL_PER_DAY, windowSec: 86400 },
    ]);
    if (!ok) return json({ error: 'rate_limited' }, 429);
  }

  // 2) Turnstile — only real users reach Claude. Fail SAFE: if the secret isn't
  //    configured, lock the endpoint (never call Claude unprotected). The client
  //    treats this like 503 and falls back to canned presets.
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return json({ error: 'challenge_unavailable' }, 403);
  if (!(await verifyTurnstile(body.turnstileToken, ip, secret))) {
    return json({ error: 'failed_challenge' }, 403);
  }

  // 3) Generation
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'generation_not_configured' }, 503);

  const description = (body.description || '').trim();
  if (!description) return json({ error: 'missing_description' }, 400);

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM,
        tools: [DESIGN_TOOL],
        tool_choice: { type: 'tool', name: 'render_arms' },
        messages: [{ role: 'user', content: description.slice(0, 2000) }],
      }),
    });
  } catch (e) {
    return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
  }

  if (!upstream.ok) return json({ error: 'upstream_error', status: upstream.status, detail: await upstream.text() }, 502);

  const data = await upstream.json();
  const tool = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'render_arms');
  if (!tool || !tool.input || !tool.input.field) return json({ error: 'no_design' }, 502);

  return json({ design: tool.input });
}

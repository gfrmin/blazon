// ─────────────────────────────────────────────────────────────────────────
// Fixed-window rate limiter backed by Workers KV.
//
// A counter per (key, time-bucket). KV is eventually consistent, so this is a
// cost BACKSTOP, not a precise quota — good enough to cap abuse spend. Pure
// except for the injected `kv`; `now` is injectable so it's unit-testable.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {{get:Function, put:Function}} kv   a KV namespace
 * @param {string} baseKey                    identity for the limit (e.g. "ip:1.2.3.4:min")
 * @param {{limit:number, windowSec:number, now?:number}} opts
 * @returns {Promise<{ok:boolean, remaining:number, key:string}>}
 */
export async function checkRate(kv, baseKey, { limit, windowSec, now = Date.now() }) {
  const bucket = Math.floor(now / (windowSec * 1000));
  const key = `rl:${baseKey}:${bucket}`;
  const cur = parseInt(await kv.get(key), 10) || 0;
  if (cur >= limit) return { ok: false, remaining: 0, key };
  // TTL a little past the window so the bucket self-expires.
  await kv.put(key, String(cur + 1), { expirationTtl: windowSec + 60 });
  return { ok: true, remaining: limit - cur - 1, key };
}

/**
 * Apply several limits in order; the first failure short-circuits.
 * @param {{get:Function, put:Function}} kv
 * @param {Array<{baseKey:string, limit:number, windowSec:number}>} limits
 * @param {number} [now]
 * @returns {Promise<{ok:boolean}>}
 */
export async function checkRates(kv, limits, now = Date.now()) {
  for (const l of limits) {
    const r = await checkRate(kv, l.baseKey, { limit: l.limit, windowSec: l.windowSec, now });
    if (!r.ok) return { ok: false, failed: l.baseKey };
  }
  return { ok: true };
}

// Cloudflare Turnstile server-side validation.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * @returns {Promise<boolean>} true only when the token verifies against the secret.
 */
export async function verifyTurnstile(token, ip, secret) {
  if (!token || !secret) return false;
  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch(SITEVERIFY, { method: 'POST', body: form });
    if (!r.ok) return false;
    const data = await r.json();
    return !!data.success;
  } catch {
    return false;
  }
}

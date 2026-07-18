// Cloudflare Turnstile server-side validation.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * @param {string} token           the Turnstile response token from the client
 * @param {string} ip              the caller's IP (passed as remoteip)
 * @param {string} secret          the Turnstile secret key
 * @param {string[]} [allowedHostnames]  if non-empty, the token's solved-on
 *        hostname (returned by siteverify) must be one of these — rejects a
 *        token minted with our public sitekey but solved on someone else's
 *        site. Left empty (the default) the hostname is not checked, so this is
 *        opt-in: set env.TURNSTILE_HOSTNAMES once the prod hostname is confirmed.
 * @returns {Promise<boolean>} true only when the token verifies against the secret.
 */
export async function verifyTurnstile(token, ip, secret, allowedHostnames = []) {
  if (!token || !secret) return false;
  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch(SITEVERIFY, { method: 'POST', body: form });
    if (!r.ok) return false;
    const data = await r.json();
    if (!data.success) return false;
    if (allowedHostnames.length) return allowedHostnames.includes(data.hostname);
    return true;
  } catch {
    return false;
  }
}

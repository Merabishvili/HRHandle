const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * Returns `true` (allow) when:
 *   - `TURNSTILE_SECRET_KEY` is **not** configured (fail-open during rollout — a
 *     warning is logged so missing config is visible), OR
 *   - the secret is configured and Cloudflare confirms the token.
 *
 * Returns `false` (deny) when the secret IS configured and the token is missing,
 * malformed, or rejected by Cloudflare.
 */
export async function verifyCaptcha(
  token: string | null,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.warn(
      '[turnstile] TURNSTILE_SECRET_KEY not set — captcha verification skipped. Set this env var to activate enforcement.',
    )
    return true
  }
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body })
    const json = (await res.json()) as { success?: boolean }
    return json.success === true
  } catch (err) {
    console.error('[turnstile] verification failed:', err)
    return false
  }
}

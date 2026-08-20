/** Minimal next-intl translator shape (callable + `.has`). Local to avoid
 * importing the client hook's type into a shared lib. */
type Translator = {
  (key: string, values?: Record<string, string | number>): string
  has: (key: string) => boolean
}

/**
 * Supabase auth errors carry an English `message` composed by GoTrue and, on
 * recent versions, a stable `code`. We can't translate the raw message, so map
 * the well-known codes (and, as a fallback, match the message) to i18n keys.
 * Anything unmapped falls back to a generic "failed" string so a new code never
 * renders raw English (#16).
 */
const CODE_KEY: Record<string, string> = {
  invalid_credentials: 'auth.errInvalidCredentials',
  user_not_found: 'auth.errInvalidCredentials',
  validation_failed: 'auth.errInvalidCredentials',
  email_not_confirmed: 'auth.errEmailNotConfirmed',
  over_request_rate_limit: 'auth.errRateLimit',
  over_email_send_rate_limit: 'auth.errRateLimit',
  user_already_exists: 'auth.errUserExists',
  email_exists: 'auth.errUserExists',
  weak_password: 'auth.errWeakPassword',
  captcha_failed: 'auth.errCaptcha',
}

export function authErrorMessage(
  t: Translator,
  error: unknown,
  fallbackKey = 'auth.errSignInFailed',
): string {
  const code = (error as { code?: string } | null)?.code
  const message = (error as { message?: string } | null)?.message ?? ''

  if (code && CODE_KEY[code]) return t(CODE_KEY[code])

  // Older errors only carry a message — match the well-known English phrases.
  if (/invalid login credentials/i.test(message)) return t('auth.errInvalidCredentials')
  if (/email not confirmed/i.test(message)) return t('auth.errEmailNotConfirmed')
  if (/already registered|already exists/i.test(message)) return t('auth.errUserExists')
  if (/captcha/i.test(message)) return t('auth.errCaptcha')
  if (/rate limit|too many/i.test(message)) return t('auth.errRateLimit')
  if (/weak password|at least/i.test(message)) return t('auth.errWeakPassword')

  return t(fallbackKey)
}

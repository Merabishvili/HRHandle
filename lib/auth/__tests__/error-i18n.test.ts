import { describe, it, expect } from 'vitest'
import { authErrorMessage } from '@/lib/auth/error-i18n'

// Echo the key back so we can assert which one was chosen without real copy.
function makeT() {
  const t = ((key: string) => key) as {
    (key: string, values?: Record<string, string | number>): string
    has: (key: string) => boolean
  }
  t.has = () => true
  return t
}

describe('authErrorMessage', () => {
  const t = makeT()

  it('maps a Supabase error code to its key', () => {
    expect(authErrorMessage(t, { code: 'invalid_credentials', message: 'Invalid login credentials' }))
      .toBe('auth.errInvalidCredentials')
    expect(authErrorMessage(t, { code: 'user_already_exists', message: 'x' })).toBe('auth.errUserExists')
    expect(authErrorMessage(t, { code: 'over_email_send_rate_limit', message: 'x' })).toBe('auth.errRateLimit')
  })

  it('falls back to matching the English message when there is no code', () => {
    expect(authErrorMessage(t, { message: 'Invalid login credentials' })).toBe('auth.errInvalidCredentials')
    expect(authErrorMessage(t, new Error('Email not confirmed'))).toBe('auth.errEmailNotConfirmed')
    expect(authErrorMessage(t, new Error('User already registered'))).toBe('auth.errUserExists')
  })

  it('uses the provided fallback key for anything unrecognized', () => {
    expect(authErrorMessage(t, new Error('boom'))).toBe('auth.errSignInFailed')
    expect(authErrorMessage(t, new Error('boom'), 'auth.errCreateFailed')).toBe('auth.errCreateFailed')
    expect(authErrorMessage(t, null, 'changePw.genericError')).toBe('changePw.genericError')
  })
})

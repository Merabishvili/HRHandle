import { describe, it, expect, vi, beforeEach } from 'vitest'

const headersMock = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: headersMock }),
}))

const resetPasswordForEmailMock = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { resetPasswordForEmail: resetPasswordForEmailMock },
  }),
}))

const REDIRECT = 'https://example.com/auth/confirm?type=recovery&next=/auth/reset-password'

// `requestPasswordReset` holds module-scoped rate-limit state — reload between
// tests to keep them independent.
async function loadAction() {
  vi.resetModules()
  resetPasswordForEmailMock.mockReset()
  resetPasswordForEmailMock.mockResolvedValue({ error: null })
  return (await import('@/lib/actions/auth')).requestPasswordReset
}

describe('requestPasswordReset', () => {
  beforeEach(() => {
    headersMock.mockReturnValue('unknown')
  })

  it('rejects invalid email format without calling Supabase', async () => {
    const requestPasswordReset = await loadAction()
    const res = await requestPasswordReset('not-an-email', REDIRECT)
    expect(res).toEqual({ success: false, error: 'Please enter a valid email address.' })
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
  })

  it('returns a generic success message for valid input', async () => {
    const requestPasswordReset = await loadAction()
    const res = await requestPasswordReset('alice@example.com', REDIRECT)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.message).toContain('reset link has been sent')
    }
    expect(resetPasswordForEmailMock).toHaveBeenCalledOnce()
  })

  it('blocks the 6th request for the same email within the hour', async () => {
    const requestPasswordReset = await loadAction()
    for (let i = 0; i < 5; i++) {
      const res = await requestPasswordReset('victim@example.com', REDIRECT)
      expect(res.success).toBe(true)
    }
    const blocked = await requestPasswordReset('victim@example.com', REDIRECT)
    expect(blocked).toEqual({
      success: false,
      error: 'Too many password-reset requests. Please try again in an hour.',
    })
  })

  it('blocks the 6th request from the same IP regardless of email', async () => {
    const requestPasswordReset = await loadAction()
    headersMock.mockImplementation((name: string) =>
      name === 'x-forwarded-for' ? '1.2.3.4' : null,
    )
    for (let i = 0; i < 5; i++) {
      const res = await requestPasswordReset(`user${i}@example.com`, REDIRECT)
      expect(res.success).toBe(true)
    }
    const blocked = await requestPasswordReset('user5@example.com', REDIRECT)
    expect(blocked.success).toBe(false)
  })
})

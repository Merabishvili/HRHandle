import { describe, it, expect, vi, beforeEach } from 'vitest'

const headersMock = vi.fn()
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: headersMock }),
}))

const resetPasswordForEmailMock = vi.fn()
const signInWithPasswordMock = vi.fn()
// Capture the args createBrowserClient was constructed with, so we can assert
// the stateless cookie methods are present (see the getAll/setAll regression).
const createBrowserClientArgs: unknown[] = []
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => {
    createBrowserClientArgs.length = 0
    createBrowserClientArgs.push(...args)
    return {
      auth: {
        resetPasswordForEmail: resetPasswordForEmailMock,
        signInWithPassword: signInWithPasswordMock,
      },
    }
  },
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

async function loadVerifyPassword() {
  vi.resetModules()
  signInWithPasswordMock.mockReset()
  signInWithPasswordMock.mockResolvedValue({ error: null })
  return (await import('@/lib/actions/auth')).verifyPassword
}

describe('requestPasswordReset', () => {
  beforeEach(() => {
    headersMock.mockReturnValue('unknown')
  })

  it('rejects invalid email format without calling Supabase', async () => {
    const requestPasswordReset = await loadAction()
    const res = await requestPasswordReset('not-an-email', REDIRECT)
    expect(res).toEqual({ success: false, reason: 'invalid_email' })
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
  })

  it('returns a generic success (no reason leaked) for valid input', async () => {
    const requestPasswordReset = await loadAction()
    const res = await requestPasswordReset('alice@example.com', REDIRECT)
    expect(res).toEqual({ success: true })
    expect(resetPasswordForEmailMock).toHaveBeenCalledOnce()
  })

  it('forwards the captcha token to Supabase (Supabase enforces captcha now)', async () => {
    const requestPasswordReset = await loadAction()
    await requestPasswordReset('alice@example.com', REDIRECT, 'tok-123')
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({ captchaToken: 'tok-123' }),
    )
  })

  it('surfaces a captcha failure instead of a fake success', async () => {
    const requestPasswordReset = await loadAction()
    resetPasswordForEmailMock.mockResolvedValueOnce({
      error: { code: 'captcha_failed', message: 'captcha verification process failed' },
    })
    const res = await requestPasswordReset('alice@example.com', REDIRECT, 'bad')
    expect(res).toEqual({ success: false, reason: 'captcha' })
  })

  it('still returns generic success on other soft errors (no enumeration)', async () => {
    const requestPasswordReset = await loadAction()
    resetPasswordForEmailMock.mockResolvedValueOnce({
      error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
    })
    const res = await requestPasswordReset('alice@example.com', REDIRECT, 'tok')
    expect(res).toEqual({ success: true })
  })

  // Regression: createBrowserClient runs inside a server action (non-browser
  // runtime), so it MUST receive cookie methods or @supabase/ssr throws
  // "createBrowserClient in non-browser runtimes … needs getAll/setAll". They
  // must also be stateless (read/persist nothing) for a reset-email request.
  it('constructs the client with stateless cookie methods', async () => {
    const requestPasswordReset = await loadAction()
    await requestPasswordReset('alice@example.com', REDIRECT)

    const opts = createBrowserClientArgs[2] as {
      auth?: { flowType?: string }
      cookies?: { getAll?: () => unknown; setAll?: () => unknown }
    }
    expect(opts?.auth?.flowType).toBe('implicit')
    expect(typeof opts?.cookies?.getAll).toBe('function')
    expect(typeof opts?.cookies?.setAll).toBe('function')
    // Stateless: reads nothing, and writing is a harmless no-op.
    expect(opts.cookies!.getAll!()).toEqual([])
    expect(() => opts.cookies!.setAll!()).not.toThrow()
  })

  it('blocks the 6th request for the same email within the hour', async () => {
    const requestPasswordReset = await loadAction()
    for (let i = 0; i < 5; i++) {
      const res = await requestPasswordReset('victim@example.com', REDIRECT)
      expect(res.success).toBe(true)
    }
    const blocked = await requestPasswordReset('victim@example.com', REDIRECT)
    expect(blocked).toEqual({ success: false, reason: 'rate_limit' })
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

describe('verifyPassword (stateless — must not touch the caller session)', () => {
  it('no error → success, and forwards the captcha token', async () => {
    const verifyPassword = await loadVerifyPassword()
    const res = await verifyPassword('a@b.com', 'pw', 'tok-9')
    expect(res).toEqual({ success: true })
    expect(signInWithPasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', password: 'pw', options: { captchaToken: 'tok-9' } }),
    )
  })

  it('captcha error → reason captcha', async () => {
    const verifyPassword = await loadVerifyPassword()
    signInWithPasswordMock.mockResolvedValueOnce({ error: { code: 'captcha_failed', message: 'captcha failed' } })
    expect(await verifyPassword('a@b.com', 'pw', 'x')).toEqual({ success: false, reason: 'captcha' })
  })

  it('wrong password → reason invalid', async () => {
    const verifyPassword = await loadVerifyPassword()
    signInWithPasswordMock.mockResolvedValueOnce({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    expect(await verifyPassword('a@b.com', 'nope')).toEqual({ success: false, reason: 'invalid' })
  })

  it('empty input short-circuits without a network call', async () => {
    const verifyPassword = await loadVerifyPassword()
    expect(await verifyPassword('', '')).toEqual({ success: false, reason: 'invalid' })
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })
})

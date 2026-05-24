import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyCaptcha } from '@/lib/turnstile'

describe('verifyCaptcha', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fails-open and warns when TURNSTILE_SECRET_KEY is not set', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ok = await verifyCaptcha(null, null)
    expect(ok).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it('rejects when the secret is configured but no token is supplied', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    const ok = await verifyCaptcha(null, '1.2.3.4')
    expect(ok).toBe(false)
  })

  it('accepts when Cloudflare returns {success:true}', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    }) as unknown as typeof fetch

    const ok = await verifyCaptcha('a-valid-token', '1.2.3.4')
    expect(ok).toBe(true)

    // Verify the secret + token + remoteip were forwarded
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    const body = call[1].body as URLSearchParams
    expect(body.get('secret')).toBe('test-secret')
    expect(body.get('response')).toBe('a-valid-token')
    expect(body.get('remoteip')).toBe('1.2.3.4')
  })

  it('rejects when Cloudflare returns {success:false}', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    }) as unknown as typeof fetch

    const ok = await verifyCaptcha('bad-token', null)
    expect(ok).toBe(false)
  })

  it('rejects (and logs) when the Cloudflare fetch throws', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret'
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const ok = await verifyCaptcha('a-token', null)
    expect(ok).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { callbackOrigin, siteBaseUrl } from '@/lib/site-url'

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL
})

describe('siteBaseUrl', () => {
  it('returns the value unchanged when it has no trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hrhandle.com'
    expect(siteBaseUrl()).toBe('https://hrhandle.com')
  })

  it('strips a single trailing slash (the redirect_uri_mismatch cause)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hrhandle.com/'
    expect(siteBaseUrl()).toBe('https://hrhandle.com')
    // The bug this prevents: `${base}/api/auth/google/callback` must not double-slash.
    expect(`${siteBaseUrl()}/api/auth/google/callback`).toBe(
      'https://hrhandle.com/api/auth/google/callback',
    )
  })

  it('strips multiple trailing slashes', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hrhandle.com///'
    expect(siteBaseUrl()).toBe('https://hrhandle.com')
  })

  it('falls back to localhost when unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(siteBaseUrl()).toBe('http://localhost:3000')
  })

  it('falls back to localhost for an empty string (avoids a bare relative redirect_uri)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ''
    expect(siteBaseUrl()).toBe('http://localhost:3000')
  })
})

describe('callbackOrigin', () => {
  const hdrs = (entries: Record<string, string>) => new Headers(entries)

  it('uses the host serving the request, not the apex env value (apex 307s to www)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hrhandle.com/'
    expect(
      callbackOrigin(hdrs({ 'x-forwarded-host': 'www.hrhandle.com', 'x-forwarded-proto': 'https' })),
    ).toBe('https://www.hrhandle.com')
  })

  it('falls back to the host header and defaults to https', () => {
    expect(callbackOrigin(hdrs({ host: 'staging.hrhandle.com' }))).toBe('https://staging.hrhandle.com')
  })

  it('takes the first value of a comma-separated forwarded header', () => {
    expect(
      callbackOrigin(hdrs({ 'x-forwarded-host': 'www.hrhandle.com, proxy.internal', 'x-forwarded-proto': 'https, http' })),
    ).toBe('https://www.hrhandle.com')
  })

  it('uses http for localhost', () => {
    expect(callbackOrigin(hdrs({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  })

  it('falls back to siteBaseUrl() without a host', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://hrhandle.com/'
    expect(callbackOrigin(hdrs({}))).toBe('https://hrhandle.com')
  })
})

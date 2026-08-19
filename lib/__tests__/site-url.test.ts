import { describe, it, expect, afterEach } from 'vitest'
import { siteBaseUrl } from '@/lib/site-url'

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

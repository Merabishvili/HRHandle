import { describe, it, expect } from 'vitest'
import { parseUserAgent } from '@/lib/active-sessions/parse-user-agent'

describe('parseUserAgent', () => {
  it('returns Unknown for null / empty', () => {
    expect(parseUserAgent(null)).toEqual({
      device: 'unknown',
      os: 'Unknown device',
      browser: 'Unknown browser',
    })
    expect(parseUserAgent('')).toEqual({
      device: 'unknown',
      os: 'Unknown device',
      browser: 'Unknown browser',
    })
  })

  it('detects iPhone + Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(parseUserAgent(ua)).toEqual({ device: 'mobile', os: 'iPhone', browser: 'Safari' })
  })

  it('detects iPad + Safari', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1'
    const p = parseUserAgent(ua)
    expect(p.device).toBe('tablet')
    expect(p.os).toBe('iPad')
    expect(p.browser).toBe('Safari')
  })

  it('detects macOS + Chrome', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({ device: 'desktop', os: 'macOS', browser: 'Chrome' })
  })

  it('detects Windows + Edge', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(parseUserAgent(ua)).toEqual({ device: 'desktop', os: 'Windows', browser: 'Edge' })
  })

  it('detects Android mobile + Chrome', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({ device: 'mobile', os: 'Android', browser: 'Chrome' })
  })

  it('detects Linux + Firefox', () => {
    const ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'
    expect(parseUserAgent(ua)).toEqual({ device: 'desktop', os: 'Linux', browser: 'Firefox' })
  })
})

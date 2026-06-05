import { describe, it, expect } from 'vitest'
import {
  BLOCKED_COUNTRY_CODES,
  getRequestCountry,
  isBlockedCountry,
  getBlockedCountry,
} from '@/lib/sanctions'

/** Tiny stand-in for the Next.js / Web Headers API the helpers consume. */
function fakeHeaders(map: Record<string, string>) {
  return {
    get(name: string): string | null {
      // Match Web Headers semantics: case-insensitive lookup.
      const key = Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase())
      return key ? map[key] : null
    },
  }
}

describe('BLOCKED_COUNTRY_CODES', () => {
  it('contains the eight expected ISO codes (KP, IR, MM, SY, CU, BY, RU, VE)', () => {
    expect(BLOCKED_COUNTRY_CODES).toEqual(['KP', 'IR', 'MM', 'SY', 'CU', 'BY', 'RU', 'VE'])
  })

  it('contains only two-letter upper-case codes', () => {
    for (const code of BLOCKED_COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(BLOCKED_COUNTRY_CODES).size).toBe(BLOCKED_COUNTRY_CODES.length)
  })
})

describe('getRequestCountry', () => {
  it('reads x-vercel-ip-country and upper-cases it', () => {
    expect(getRequestCountry(fakeHeaders({ 'x-vercel-ip-country': 'us' }))).toBe('US')
  })

  it('returns null when the header is missing (local dev / test)', () => {
    expect(getRequestCountry(fakeHeaders({}))).toBeNull()
  })

  it('returns null when the header is an empty string', () => {
    expect(getRequestCountry(fakeHeaders({ 'x-vercel-ip-country': '' }))).toBeNull()
  })

  it('trims whitespace from the header value', () => {
    expect(getRequestCountry(fakeHeaders({ 'x-vercel-ip-country': '  ge  ' }))).toBe('GE')
  })
})

describe('isBlockedCountry', () => {
  it('returns true for every code on the blocklist', () => {
    for (const code of BLOCKED_COUNTRY_CODES) {
      expect(isBlockedCountry(code)).toBe(true)
    }
  })

  it('is case-insensitive', () => {
    expect(isBlockedCountry('kp')).toBe(true)
    expect(isBlockedCountry('Ir')).toBe(true)
  })

  it('returns false for non-blocked countries', () => {
    expect(isBlockedCountry('US')).toBe(false)
    expect(isBlockedCountry('GE')).toBe(false)
    expect(isBlockedCountry('DE')).toBe(false)
    expect(isBlockedCountry('UA')).toBe(false)
  })

  it('returns false for null / undefined / empty', () => {
    expect(isBlockedCountry(null)).toBe(false)
    expect(isBlockedCountry(undefined)).toBe(false)
    expect(isBlockedCountry('')).toBe(false)
  })
})

describe('getBlockedCountry', () => {
  it('returns the upper-cased code when the request is from a blocked country', () => {
    expect(getBlockedCountry(fakeHeaders({ 'x-vercel-ip-country': 'ru' }))).toBe('RU')
  })

  it('returns null for a non-blocked country', () => {
    expect(getBlockedCountry(fakeHeaders({ 'x-vercel-ip-country': 'GE' }))).toBeNull()
  })

  it('returns null when the header is missing (local dev fails open)', () => {
    expect(getBlockedCountry(fakeHeaders({}))).toBeNull()
  })
})

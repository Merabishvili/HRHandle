import { describe, it, expect } from 'vitest'
import {
  verifiedFactors,
  hasVerifiedFactor,
  defaultFactorName,
  normalizeTotpCode,
  isValidTotpCode,
  type FactorSummary,
} from '@/lib/mfa/factors'

const f = (id: string, status: 'verified' | 'unverified'): FactorSummary => ({
  id,
  type: 'totp',
  friendly_name: null,
  status,
  created_at: '2026-06-24T00:00:00Z',
})

describe('verifiedFactors', () => {
  it('returns only verified TOTP factors', () => {
    const out = verifiedFactors([f('a', 'verified'), f('b', 'unverified'), f('c', 'verified')])
    expect(out.map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('filters out non-TOTP factor types', () => {
    const mixed: FactorSummary[] = [
      f('a', 'verified'),
      { id: 'webauthn', type: 'webauthn', friendly_name: null, status: 'verified', created_at: '2026-06-24T00:00:00Z' },
    ]
    expect(verifiedFactors(mixed).map((x) => x.id)).toEqual(['a'])
  })
})

describe('hasVerifiedFactor', () => {
  it('returns true when at least one verified factor exists', () => {
    expect(hasVerifiedFactor([f('a', 'verified')])).toBe(true)
  })
  it('returns false on empty', () => {
    expect(hasVerifiedFactor([])).toBe(false)
  })
  it('returns false when only unverified factors exist', () => {
    expect(hasVerifiedFactor([f('a', 'unverified')])).toBe(false)
  })
})

describe('defaultFactorName', () => {
  it('returns a string containing today\'s date', () => {
    const name = defaultFactorName()
    expect(name).toMatch(/^Authenticator \(\d{4}-\d{2}-\d{2}\)$/)
  })
})

describe('normalizeTotpCode', () => {
  it('strips whitespace and hyphens', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456')
    expect(normalizeTotpCode('123-456')).toBe('123456')
    expect(normalizeTotpCode(' 1 2 3 4 5 6 ')).toBe('123456')
  })

  it('returns at most 6 characters', () => {
    expect(normalizeTotpCode('1234567890').length).toBe(6)
  })

  it('handles empty input', () => {
    expect(normalizeTotpCode('')).toBe('')
    expect(normalizeTotpCode(null as unknown as string)).toBe('')
  })
})

describe('isValidTotpCode', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidTotpCode('123456')).toBe(true)
  })
  it('rejects non-digit, too-short, and too-long', () => {
    expect(isValidTotpCode('12345')).toBe(false)
    expect(isValidTotpCode('1234567')).toBe(false)
    expect(isValidTotpCode('abcdef')).toBe(false)
    expect(isValidTotpCode('12-456')).toBe(false)
    expect(isValidTotpCode('')).toBe(false)
  })
})

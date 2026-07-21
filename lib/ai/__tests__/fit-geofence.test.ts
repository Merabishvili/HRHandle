import { describe, it, expect } from 'vitest'
import { isEuCountry, canEnableAiFit } from '@/lib/ai/fit-geofence'

describe('isEuCountry', () => {
  it('recognises EU-27 + EEA (any case)', () => {
    expect(isEuCountry('DE')).toBe(true)
    expect(isEuCountry('fr')).toBe(true)
    expect(isEuCountry(' no ')).toBe(true) // Norway (EEA)
  })
  it('is false for non-EU', () => {
    expect(isEuCountry('US')).toBe(false)
    expect(isEuCountry('GB')).toBe(false) // UK left the EU
    expect(isEuCountry('GE')).toBe(false) // Georgia
  })
  it('treats null/unknown as non-EU (acknowledgement only required when positively EU)', () => {
    expect(isEuCountry(null)).toBe(false)
    expect(isEuCountry(undefined)).toBe(false)
    expect(isEuCountry('XX')).toBe(false)
  })
})

describe('canEnableAiFit', () => {
  it('allows non-EU orgs to enable via standard opt-in', () => {
    expect(canEnableAiFit('US', false)).toBe(true)
  })
  it('blocks EU orgs until they acknowledge', () => {
    expect(canEnableAiFit('DE', false)).toBe(false)
    expect(canEnableAiFit('DE', true)).toBe(true)
  })
  it('allows an unknown-country org (acknowledgement not forced)', () => {
    expect(canEnableAiFit(null, false)).toBe(true)
  })
})

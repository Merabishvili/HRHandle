import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  inferMapping,
  missingRequiredFields,
  pickCell,
} from '@/lib/candidate-import/parsing'

describe('normalizeHeader', () => {
  it('lowercases, and collapses _ / - / whitespace to single spaces', () => {
    expect(normalizeHeader('First_Name')).toBe('first name')
    expect(normalizeHeader('E-Mail')).toBe('e mail')
    expect(normalizeHeader('  Years   Experience ')).toBe('years experience')
  })
})

describe('inferMapping', () => {
  it('maps common header aliases to fields', () => {
    expect(inferMapping(['First Name', 'Surname', 'Email', 'Mobile'])).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
    ])
  })
  it('maps an "E-Mail" header to email (dash normalised to space)', () => {
    expect(inferMapping(['E-Mail'])).toEqual(['email'])
  })
  it('returns null for unknown headers', () => {
    expect(inferMapping(['first name', 'mystery'])).toEqual(['first_name', null])
  })
  it('does not map the same field twice — second duplicate becomes null', () => {
    expect(inferMapping(['Email', 'email address'])).toEqual(['email', null])
  })
})

describe('missingRequiredFields', () => {
  it('lists required fields not present in the mapping', () => {
    expect(missingRequiredFields(['first_name', 'last_name', null])).toEqual(['email'])
  })
  it('returns [] when first/last/email are all mapped', () => {
    expect(missingRequiredFields(['first_name', 'last_name', 'email', 'phone'])).toEqual([])
  })
})

describe('pickCell', () => {
  const mapping = ['first_name', 'email', null] as const
  it('returns the trimmed cell for a mapped field', () => {
    expect(pickCell(['  Jane ', 'jane@x.com', 'x'], mapping, 'first_name')).toBe('Jane')
  })
  it('returns null for an unmapped field', () => {
    expect(pickCell(['Jane', 'jane@x.com', 'x'], mapping, 'phone')).toBeNull()
  })
  it('returns null for a blank cell', () => {
    expect(pickCell(['Jane', '   ', 'x'], mapping, 'email')).toBeNull()
  })
})

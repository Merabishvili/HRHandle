import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  inferMapping,
  missingRequiredFields,
  pickCell,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
} from '@/lib/candidate-import/parsing'

describe('normalizeHeader', () => {
  it('lowercases, trims, collapses whitespace, and unifies separators', () => {
    expect(normalizeHeader('  First_Name ')).toBe('first name')
    expect(normalizeHeader('FIRSTNAME')).toBe('firstname')
    expect(normalizeHeader('first-name')).toBe('first name')
    expect(normalizeHeader('first  name')).toBe('first name')
  })

  it('handles empty input', () => {
    expect(normalizeHeader('')).toBe('')
    expect(normalizeHeader('   ')).toBe('')
  })
})

describe('inferMapping', () => {
  it('matches the template headers verbatim', () => {
    const headers = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'current_company',
      'current_position',
      'years_of_experience',
      'linkedin_url',
      'location',
      'source',
      'languages',
      'salary_expectation',
      'notice_period',
    ]
    const mapping = inferMapping(headers)
    expect(mapping).toEqual(headers as unknown as ReturnType<typeof inferMapping>)
  })

  it('matches common human variants', () => {
    const mapping = inferMapping([
      'First Name',
      'Last Name',
      'Email Address',
      'Phone Number',
      'Company',
      'Job Title',
      'YoE',
      'LinkedIn',
    ])
    expect(mapping).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
      'current_company',
      'current_position',
      'years_of_experience',
      'linkedin_url',
    ])
  })

  it('returns null for unrecognised columns', () => {
    expect(inferMapping(['nickname', 'eye color'])).toEqual([null, null])
  })

  it('avoids assigning the same field twice', () => {
    const mapping = inferMapping(['email', 'mail'])
    expect(mapping[0]).toBe('email')
    expect(mapping[1]).toBe(null)
  })

  it('returns null for blank headers', () => {
    expect(inferMapping(['', '  ', 'email'])).toEqual([null, null, 'email'])
  })
})

describe('missingRequiredFields', () => {
  it('returns all required fields when nothing is mapped', () => {
    expect(missingRequiredFields([null, null, null])).toEqual([...REQUIRED_FIELDS])
  })

  it('returns the unmapped required fields only', () => {
    expect(missingRequiredFields(['first_name', null, 'phone'])).toEqual([
      'last_name',
      'email',
    ])
  })

  it('returns [] when all required fields are mapped', () => {
    expect(missingRequiredFields(['first_name', 'last_name', 'email'])).toEqual([])
  })
})

describe('pickCell', () => {
  const mapping = ['first_name', 'email', null] as const

  it('returns the trimmed value for a mapped column', () => {
    expect(pickCell(['  Jane  ', 'jane@x.com', 'ignored'], mapping, 'first_name')).toBe('Jane')
    expect(pickCell(['Jane', 'jane@x.com', 'ignored'], mapping, 'email')).toBe('jane@x.com')
  })

  it('returns null for an unmapped field', () => {
    expect(pickCell(['Jane', 'jane@x.com', 'ignored'], mapping, 'phone')).toBe(null)
  })

  it('returns null for blank / missing values', () => {
    expect(pickCell(['', 'jane@x.com'], mapping, 'first_name')).toBe(null)
    expect(pickCell([], mapping, 'first_name')).toBe(null)
  })
})

describe('IMPORT_FIELDS', () => {
  it('includes all required fields', () => {
    for (const f of REQUIRED_FIELDS) {
      expect(IMPORT_FIELDS).toContain(f)
    }
  })
})

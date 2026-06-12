import { describe, it, expect } from 'vitest'
import {
  validateRow,
  buildErrorReportCsv,
  escapeCsvCell,
  coerceRow,
} from '@/lib/candidate-import/validation'

describe('coerceRow', () => {
  it('parses years_of_experience as a number', () => {
    const c = coerceRow({ values: { years_of_experience: '5' } })
    expect(c.years_of_experience).toBe(5)
  })

  it('accepts comma as decimal separator', () => {
    const c = coerceRow({ values: { years_of_experience: '4,5' } })
    expect(c.years_of_experience).toBe(4.5)
  })

  it('returns null for blank years_of_experience', () => {
    const c = coerceRow({ values: { years_of_experience: null } })
    expect(c.years_of_experience).toBe(null)
  })

  it('splits languages on ; and ,', () => {
    expect(coerceRow({ values: { languages: 'English;German' } }).languages).toEqual([
      'English',
      'German',
    ])
    expect(coerceRow({ values: { languages: 'a, b , c ' } }).languages).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('returns [] for blank languages', () => {
    expect(coerceRow({ values: { languages: null } }).languages).toEqual([])
  })
})

describe('validateRow', () => {
  it('accepts a complete valid row', () => {
    const res = validateRow({
      values: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'JANE@example.com',
        phone: '+1 555 111 2222',
        current_company: 'Acme',
        current_position: 'Eng',
        years_of_experience: '5',
        linkedin_url: 'https://linkedin.com/in/jane',
        location: 'Berlin',
        source: 'Referral',
        languages: 'en; de',
        salary_expectation: '80k',
        notice_period: '1 month',
      },
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row.email).toBe('jane@example.com') // lowercased
      expect(res.row.years_of_experience).toBe(5)
      expect(res.row.languages).toEqual(['en', 'de'])
    }
  })

  it('rejects missing first_name', () => {
    const res = validateRow({
      values: { first_name: null, last_name: 'Doe', email: 'a@b.com' },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.toLowerCase()).toContain('first name')
  })

  it('rejects missing email', () => {
    const res = validateRow({
      values: { first_name: 'Jane', last_name: 'Doe' },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.toLowerCase()).toContain('email')
  })

  it('rejects malformed email', () => {
    const res = validateRow({
      values: { first_name: 'Jane', last_name: 'Doe', email: 'not-an-email' },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.toLowerCase()).toContain('invalid email')
  })

  it('rejects malformed linkedin url', () => {
    const res = validateRow({
      values: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@x.com',
        linkedin_url: 'linkedin.com/jane',
      },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.toLowerCase()).toContain('linkedin')
  })

  it('rejects non-numeric years_of_experience', () => {
    const res = validateRow({
      values: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@x.com',
        years_of_experience: 'not a number',
      },
    })
    expect(res.ok).toBe(false)
  })

  it('accepts optional fields as null', () => {
    const res = validateRow({
      values: { first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row.phone).toBe(null)
      expect(res.row.languages).toEqual([])
    }
  })
})

describe('escapeCsvCell', () => {
  it('returns plain text untouched', () => {
    expect(escapeCsvCell('hello')).toBe('hello')
  })

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('a"b')).toBe('"a""b"')
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
  })
})

describe('buildErrorReportCsv', () => {
  it('writes header + each failure row with original cells and error', () => {
    const csv = buildErrorReportCsv(
      ['first_name', 'email'],
      [
        { rowNumber: 2, original: ['Jane', 'bad'], error: 'email: Invalid' },
        { rowNumber: 3, original: ['', 'b@c.com'], error: 'first_name: required' },
      ]
    )
    const lines = csv.split('\n')
    expect(lines[0]).toBe('row,first_name,email,error')
    expect(lines[1]).toBe('2,Jane,bad,email: Invalid')
    expect(lines[2]).toBe('3,,b@c.com,first_name: required')
  })

  it('escapes cells with commas/quotes', () => {
    const csv = buildErrorReportCsv(
      ['name'],
      [{ rowNumber: 2, original: ['Doe, Jane'], error: 'said "no"' }]
    )
    expect(csv).toContain('"Doe, Jane"')
    expect(csv).toContain('"said ""no"""')
  })
})

import { describe, it, expect } from 'vitest'
import { csvCell } from '@/lib/csv'

describe('csvCell — formula-injection guard', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'neutralises a leading formula char with a quote: %j',
    (v) => {
      // Prefixed with ' — after any surrounding delimiter-quote (a leading \r
      // also forces RFC-4180 quoting, so the ' sits just inside the opening ").
      expect(/^"?'/.test(csvCell(v))).toBe(true)
    },
  )
  it('neutralises a classic command-injection payload', () => {
    expect(csvCell('=cmd|\' /c calc\'!A1')).toMatch(/^"?'=cmd/)
  })
  it('leaves ordinary text untouched', () => {
    expect(csvCell('Jane Doe')).toBe('Jane Doe')
    expect(csvCell('a-b')).toBe('a-b') // hyphen mid-string is fine
  })
})

describe('csvCell — delimiter quoting (RFC 4180)', () => {
  it('quotes values containing a comma', () => {
    expect(csvCell('Doe, Jane')).toBe('"Doe, Jane"')
  })
  it('doubles internal quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it('quotes values containing a newline', () => {
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })
  it('a formula char AND a comma is both prefixed and quoted', () => {
    expect(csvCell('=a,b')).toBe('"\'=a,b"')
  })
})

describe('csvCell — nullish + numbers', () => {
  it('returns empty string for null/undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
  it('stringifies numbers', () => {
    expect(csvCell(42)).toBe('42')
  })
})

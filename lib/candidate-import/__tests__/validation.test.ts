import { describe, it, expect } from 'vitest'
import { validateRow, type RawRow } from '@/lib/candidate-import/validation'

const base: RawRow = {
  values: {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'JANE@Example.com',
  },
}

function row(over: Partial<RawRow['values']>): RawRow {
  return { values: { ...base.values, ...over } }
}

describe('validateRow — happy path', () => {
  it('accepts a minimal valid row and lowercases the email', () => {
    const r = validateRow(base)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.row.email).toBe('jane@example.com')
  })

  it('splits languages on ; and ,', () => {
    const r = validateRow(row({ languages: 'English; Spanish, French' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.row.languages).toEqual(['English', 'Spanish', 'French'])
  })

  it('parses years_of_experience, accepting a comma decimal', () => {
    const r = validateRow(row({ years_of_experience: '5,5' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.row.years_of_experience).toBe(5.5)
  })

  it('treats blank optional fields as null (parsing.ts emits null for empty cells)', () => {
    // The parsing layer normalises empty cells to null before coerceRow runs
    // (see parsing.ts: `trimmed.length === 0 ? null : trimmed`).
    const r = validateRow(row({ phone: null, linkedin_url: null, years_of_experience: null }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row.phone).toBeNull()
      expect(r.row.linkedin_url).toBeNull()
      expect(r.row.years_of_experience).toBeNull()
    }
  })
})

describe('validateRow — errors', () => {
  it('rejects a missing first name with a field-scoped message', () => {
    const r = validateRow(row({ first_name: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/first_name/)
  })

  it('rejects an invalid email', () => {
    const r = validateRow(row({ email: 'not-an-email' }))
    expect(r.ok).toBe(false)
  })

  it('rejects an invalid LinkedIn URL', () => {
    const r = validateRow(row({ linkedin_url: 'linkedin.com/in/x' }))
    expect(r.ok).toBe(false)
  })
})

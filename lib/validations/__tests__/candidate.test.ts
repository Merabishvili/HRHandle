import { describe, it, expect } from 'vitest'
import { CandidateSchema, CandidateFormSchema } from '@/lib/validations/candidate'

const base = { first_name: 'Jane', last_name: 'Smith' }

// ─── Required fields ──────────────────────────────────────────────────────────

describe('CandidateSchema — required fields', () => {
  it('accepts minimal valid input (first_name + last_name only)', () => {
    expect(CandidateSchema.safeParse(base).success).toBe(true)
  })

  it('rejects empty first_name', () => {
    const result = CandidateSchema.safeParse({ ...base, first_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty last_name', () => {
    const result = CandidateSchema.safeParse({ ...base, last_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing first_name key', () => {
    const { first_name: _, ...rest } = base
    expect(CandidateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing last_name key', () => {
    const { last_name: _, ...rest } = base
    expect(CandidateSchema.safeParse(rest).success).toBe(false)
  })
})

// ─── Name length limits ───────────────────────────────────────────────────────

describe('CandidateSchema — name length', () => {
  it('accepts first_name of exactly 100 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, first_name: 'A'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects first_name of 101 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, first_name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts last_name of exactly 100 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, last_name: 'A'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects last_name of 101 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, last_name: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

// ─── Email ────────────────────────────────────────────────────────────────────

describe('CandidateSchema — email', () => {
  it('accepts a valid email', () => {
    const result = CandidateSchema.safeParse({ ...base, email: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('accepts email with plus-addressing', () => {
    const result = CandidateSchema.safeParse({ ...base, email: 'user+tag@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email format', () => {
    const result = CandidateSchema.safeParse({ ...base, email: 'notanemail' })
    expect(result.success).toBe(false)
  })

  it('rejects email missing domain', () => {
    const result = CandidateSchema.safeParse({ ...base, email: 'user@' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string email — transforms to null', () => {
    const result = CandidateSchema.safeParse({ ...base, email: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })

  it('accepts omitted email (optional)', () => {
    const result = CandidateSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('accepts null email', () => {
    const result = CandidateSchema.safeParse({ ...base, email: null })
    expect(result.success).toBe(true)
  })
})

// ─── Phone ────────────────────────────────────────────────────────────────────

describe('CandidateSchema — phone', () => {
  it('accepts a phone number', () => {
    const result = CandidateSchema.safeParse({ ...base, phone: '+1-800-555-0100' })
    expect(result.success).toBe(true)
  })

  it('accepts phone of exactly 30 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, phone: '1'.repeat(30) })
    expect(result.success).toBe(true)
  })

  it('rejects phone of 31 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, phone: '1'.repeat(31) })
    expect(result.success).toBe(false)
  })

  it('accepts null phone (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, phone: null })
    expect(result.success).toBe(true)
  })
})

// ─── Location & timezone ─────────────────────────────────────────────────────

describe('CandidateSchema — location', () => {
  it('accepts a location string', () => {
    const result = CandidateSchema.safeParse({ ...base, location: 'Tbilisi, Georgia' })
    expect(result.success).toBe(true)
  })

  it('accepts location of exactly 200 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, location: 'A'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects location of 201 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, location: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts null location (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, location: null })
    expect(result.success).toBe(true)
  })
})

describe('CandidateSchema — timezone', () => {
  it('accepts a timezone string', () => {
    const result = CandidateSchema.safeParse({ ...base, timezone: 'Asia/Tbilisi' })
    expect(result.success).toBe(true)
  })

  it('accepts timezone of exactly 100 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, timezone: 'A'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects timezone of 101 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, timezone: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts null timezone (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, timezone: null })
    expect(result.success).toBe(true)
  })
})

// ─── Languages ────────────────────────────────────────────────────────────────

describe('CandidateSchema — languages', () => {
  it('accepts an array of language strings', () => {
    const result = CandidateSchema.safeParse({ ...base, languages: ['English', 'Georgian'] })
    expect(result.success).toBe(true)
  })

  it('accepts an empty array', () => {
    const result = CandidateSchema.safeParse({ ...base, languages: [] })
    expect(result.success).toBe(true)
  })

  it('accepts omitted languages (optional)', () => {
    const result = CandidateSchema.safeParse(base)
    expect(result.success).toBe(true)
  })
})

// ─── Salary expectation & notice period ──────────────────────────────────────

describe('CandidateSchema — salary_expectation', () => {
  it('accepts a salary expectation string', () => {
    const result = CandidateSchema.safeParse({ ...base, salary_expectation: '$80k–$100k' })
    expect(result.success).toBe(true)
  })

  it('accepts salary_expectation of exactly 200 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, salary_expectation: 'A'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects salary_expectation of 201 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, salary_expectation: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts null salary_expectation (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, salary_expectation: null })
    expect(result.success).toBe(true)
  })
})

describe('CandidateSchema — notice_period', () => {
  it('accepts a notice period string', () => {
    const result = CandidateSchema.safeParse({ ...base, notice_period: '2 weeks' })
    expect(result.success).toBe(true)
  })

  it('accepts notice_period of exactly 100 characters (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, notice_period: 'A'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects notice_period of 101 characters', () => {
    const result = CandidateSchema.safeParse({ ...base, notice_period: 'A'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts null notice_period (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, notice_period: null })
    expect(result.success).toBe(true)
  })
})

// ─── LinkedIn URL ─────────────────────────────────────────────────────────────

describe('CandidateSchema — linkedin_profile_url', () => {
  it('accepts a valid HTTPS LinkedIn URL', () => {
    const result = CandidateSchema.safeParse({
      ...base,
      linkedin_profile_url: 'https://linkedin.com/in/johndoe',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a URL without scheme (e.g. linkedin.com/in/johndoe)', () => {
    const result = CandidateSchema.safeParse({
      ...base,
      linkedin_profile_url: 'linkedin.com/in/johndoe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a plain string that is not a URL', () => {
    const result = CandidateSchema.safeParse({ ...base, linkedin_profile_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string linkedin_profile_url — transforms to null', () => {
    const result = CandidateSchema.safeParse({ ...base, linkedin_profile_url: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.linkedin_profile_url).toBeNull()
  })

  it('accepts null linkedin_profile_url (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, linkedin_profile_url: null })
    expect(result.success).toBe(true)
  })
})

// ─── CandidateFormSchema (react-hook-form edit/create form) ───────────────────

// The form schema uses ''-based strings (never null) and a string[] languages,
// and only format-checks email / linkedin when non-empty.
const formBase = {
  first_name: 'Jane',
  last_name: 'Smith',
  email: '',
  phone: '',
  linkedin_profile_url: '',
  location: '',
  timezone: '',
  languages: [] as string[],
  salary_expectation: '',
  notice_period: '',
  source: '',
}

describe('CandidateFormSchema — required names', () => {
  it('accepts a minimal valid form', () => {
    expect(CandidateFormSchema.safeParse(formBase).success).toBe(true)
  })

  it('rejects empty first_name', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, first_name: '' }).success).toBe(false)
  })

  it('rejects whitespace-only last_name (trimmed to empty)', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, last_name: '   ' }).success).toBe(false)
  })

  it('trims names on parse', () => {
    const result = CandidateFormSchema.safeParse({ ...formBase, first_name: '  Jane  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.first_name).toBe('Jane')
  })
})

describe('CandidateFormSchema — optional format checks', () => {
  it('accepts an empty email (optional)', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, email: '' }).success).toBe(true)
  })

  it('accepts a valid email', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, email: 'user@example.com' }).success).toBe(true)
  })

  it('rejects an invalid email when non-empty', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, email: 'notanemail' }).success).toBe(false)
  })

  it('accepts an empty linkedin_profile_url (optional)', () => {
    expect(CandidateFormSchema.safeParse({ ...formBase, linkedin_profile_url: '' }).success).toBe(true)
  })

  it('accepts a valid linkedin URL', () => {
    expect(
      CandidateFormSchema.safeParse({ ...formBase, linkedin_profile_url: 'https://linkedin.com/in/x' }).success,
    ).toBe(true)
  })

  it('rejects a bare-domain linkedin URL (no scheme)', () => {
    expect(
      CandidateFormSchema.safeParse({ ...formBase, linkedin_profile_url: 'linkedin.com/in/x' }).success,
    ).toBe(false)
  })

  it('keeps languages as a string array', () => {
    const result = CandidateFormSchema.safeParse({ ...formBase, languages: ['English', 'Georgian'] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.languages).toEqual(['English', 'Georgian'])
  })
})


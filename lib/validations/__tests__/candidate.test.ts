import { describe, it, expect } from 'vitest'
import { CandidateSchema } from '@/lib/validations/candidate'

const base = { first_name: 'Jane', last_name: 'Smith' }

// Helper: build a date string N years ago from today
function yearsAgo(n: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().split('T')[0]
}

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

// ─── Years of experience ──────────────────────────────────────────────────────

describe('CandidateSchema — years_of_experience', () => {
  it('accepts 0 (boundary min)', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts 60 (boundary max)', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: 60 })
    expect(result.success).toBe(true)
  })

  it('rejects -1 (below min)', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects 61 (above max)', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: 61 })
    expect(result.success).toBe(false)
  })

  it('accepts null years_of_experience (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: null })
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

// ─── Date of birth (age gate: must be >= 16) ──────────────────────────────────

describe('CandidateSchema — date_of_birth age validation', () => {
  it('accepts a candidate exactly 16 years old today (boundary)', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: yearsAgo(16) })
    expect(result.success).toBe(true)
  })

  it('accepts a candidate 25 years old', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: yearsAgo(25) })
    expect(result.success).toBe(true)
  })

  it('accepts a candidate 50 years old', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: yearsAgo(50) })
    expect(result.success).toBe(true)
  })

  it('rejects a candidate 10 years old (below 16)', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: yearsAgo(10) })
    expect(result.success).toBe(false)
  })

  it('rejects a candidate born yesterday (0 years old)', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const result = CandidateSchema.safeParse({
      ...base,
      date_of_birth: yesterday.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a future date of birth', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const result = CandidateSchema.safeParse({
      ...base,
      date_of_birth: tomorrow.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
  })

  it('accepts null date_of_birth (optional)', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: null })
    expect(result.success).toBe(true)
  })

  it('accepts omitted date_of_birth (optional)', () => {
    const result = CandidateSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('age refine error is reported on the date_of_birth path', () => {
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: yearsAgo(5) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('date_of_birth')
    }
  })
})

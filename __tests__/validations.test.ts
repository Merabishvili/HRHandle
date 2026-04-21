import { describe, it, expect } from 'vitest'
import { CandidateSchema } from '@/lib/validations/candidate'
import { VacancySchema } from '@/lib/validations/vacancy'
import { InterviewSchema } from '@/lib/validations/interview'

// ─── Candidate ────────────────────────────────────────────────────────────────

describe('CandidateSchema', () => {
  const base = { first_name: 'Jane', last_name: 'Smith' }

  it('accepts minimal valid input', () => {
    expect(CandidateSchema.safeParse(base).success).toBe(true)
  })

  it('rejects missing first_name', () => {
    const result = CandidateSchema.safeParse({ last_name: 'Smith' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = CandidateSchema.safeParse({ ...base, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string email (treated as blank)', () => {
    const result = CandidateSchema.safeParse({ ...base, email: '' })
    expect(result.success).toBe(true)
  })

  it('rejects candidate under 16 years old', () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 10)
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: dob.toISOString().split('T')[0] })
    expect(result.success).toBe(false)
  })

  it('accepts candidate over 16 years old', () => {
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - 25)
    const result = CandidateSchema.safeParse({ ...base, date_of_birth: dob.toISOString().split('T')[0] })
    expect(result.success).toBe(true)
  })

  it('rejects years_of_experience above 60', () => {
    const result = CandidateSchema.safeParse({ ...base, years_of_experience: 61 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid LinkedIn URL', () => {
    const result = CandidateSchema.safeParse({ ...base, linkedin_profile_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string LinkedIn URL', () => {
    const result = CandidateSchema.safeParse({ ...base, linkedin_profile_url: '' })
    expect(result.success).toBe(true)
  })
})

// ─── Vacancy ──────────────────────────────────────────────────────────────────

describe('VacancySchema', () => {
  const base = {
    title: 'Software Engineer',
    description: 'Build great things.',
    salary_currency: 'USD',
    openings_count: 1,
    start_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  }

  it('accepts minimal valid input', () => {
    expect(VacancySchema.safeParse(base).success).toBe(true)
  })

  it('rejects missing title', () => {
    const { title: _, ...rest } = base
    expect(VacancySchema.safeParse(rest).success).toBe(false)
  })

  it('rejects salary_min greater than salary_max', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 100_000, salary_max: 50_000 })
    expect(result.success).toBe(false)
  })

  it('accepts salary_min equal to salary_max', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 80_000, salary_max: 80_000 })
    expect(result.success).toBe(true)
  })

  it('rejects openings_count of 0', () => {
    const result = VacancySchema.safeParse({ ...base, openings_count: 0 })
    expect(result.success).toBe(false)
  })
})

// ─── Interview ────────────────────────────────────────────────────────────────

describe('InterviewSchema', () => {
  const futureDate = new Date(Date.now() + 3600 * 1000).toISOString()

  const base = {
    candidate_id: '00000000-0000-0000-0000-000000000001',
    vacancy_id: '00000000-0000-0000-0000-000000000002',
    scheduled_at: futureDate,
    duration_minutes: 60,
    type: 'video' as const,
  }

  it('accepts valid future interview', () => {
    expect(InterviewSchema.safeParse(base).success).toBe(true)
  })

  it('rejects interview scheduled in the past', () => {
    const result = InterviewSchema.safeParse({
      ...base,
      scheduled_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid interview type', () => {
    const result = InterviewSchema.safeParse({ ...base, type: 'carrier_pigeon' })
    expect(result.success).toBe(false)
  })

  it('rejects duration_minutes of 0', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 0 })
    expect(result.success).toBe(false)
  })
})

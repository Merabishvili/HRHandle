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

  it('accepts responsibilities as a string', () => {
    const result = VacancySchema.safeParse({ ...base, responsibilities: 'Lead the team.' })
    expect(result.success).toBe(true)
  })

  it('accepts responsibilities as null', () => {
    const result = VacancySchema.safeParse({ ...base, responsibilities: null })
    expect(result.success).toBe(true)
  })

  it('accepts missing responsibilities (optional)', () => {
    const result = VacancySchema.safeParse(base)
    expect(result.success).toBe(true)
  })
})

// ─── Evaluation score calculation ─────────────────────────────────────────────

describe('Evaluation score calculation', () => {
  type Question = { id: string; type: 'text' | 'score' }
  type Answers = Record<string, { text: string; score: number | null }>

  function calcScore(questions: Question[], answers: Answers): number | null {
    const scoreQs = questions.filter((q) => q.type === 'score')
    if (scoreQs.length === 0) return null
    if (scoreQs.some((q) => !answers[q.id]?.score)) return null
    const sum = scoreQs.reduce((acc, q) => acc + (answers[q.id]?.score ?? 0), 0)
    return Math.round((sum / (scoreQs.length * 10)) * 100)
  }

  const scoreQs: Question[] = [
    { id: 'q1', type: 'score' },
    { id: 'q2', type: 'score' },
    { id: 'q3', type: 'score' },
  ]

  it('returns correct percentage for full scores (5+8+9 / 30 = 73%)', () => {
    const answers: Answers = {
      q1: { text: '', score: 5 },
      q2: { text: '', score: 8 },
      q3: { text: '', score: 9 },
    }
    expect(calcScore(scoreQs, answers)).toBe(73)
  })

  it('returns 100 for all max scores', () => {
    const answers: Answers = {
      q1: { text: '', score: 10 },
      q2: { text: '', score: 10 },
      q3: { text: '', score: 10 },
    }
    expect(calcScore(scoreQs, answers)).toBe(100)
  })

  it('returns null when any score criteria is missing', () => {
    const answers: Answers = {
      q1: { text: '', score: 8 },
      q2: { text: '', score: null },
      q3: { text: '', score: 9 },
    }
    expect(calcScore(scoreQs, answers)).toBeNull()
  })

  it('returns null when there are no score questions', () => {
    const textOnly: Question[] = [{ id: 'q1', type: 'text' }]
    const answers: Answers = { q1: { text: 'Some text', score: null } }
    expect(calcScore(textOnly, answers)).toBeNull()
  })

  it('ignores text questions in score calculation', () => {
    const mixed: Question[] = [
      { id: 'q1', type: 'text' },
      { id: 'q2', type: 'score' },
    ]
    const answers: Answers = {
      q1: { text: 'Some answer', score: null },
      q2: { text: '', score: 7 },
    }
    expect(calcScore(mixed, answers)).toBe(70)
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

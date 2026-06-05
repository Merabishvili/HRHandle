import { describe, it, expect } from 'vitest'
import { InterviewSchema } from '@/lib/validations/interview'

const VALID_UUID_1 = '00000000-0000-0000-0000-000000000001'
const VALID_UUID_2 = '00000000-0000-0000-0000-000000000002'
const VALID_UUID_3 = '00000000-0000-0000-0000-000000000003'

// 1 hour from now
const futureDate = new Date(Date.now() + 3_600_000).toISOString()
// 1 hour in the past
const pastDate = new Date(Date.now() - 3_600_000).toISOString()

const base = {
  candidate_id: VALID_UUID_1,
  vacancy_id: VALID_UUID_2,
  scheduled_at: futureDate,
  duration_minutes: 60,
  type: 'video' as const,
}

// ─── Valid base cases ─────────────────────────────────────────────────────────

describe('InterviewSchema — valid base cases', () => {
  it('accepts a valid video interview in the future', () => {
    expect(InterviewSchema.safeParse(base).success).toBe(true)
  })

  it('accepts type=phone', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'phone' }).success).toBe(true)
  })

  it('accepts type=onsite', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'onsite' }).success).toBe(true)
  })

  it('accepts optional application_id as uuid', () => {
    const result = InterviewSchema.safeParse({ ...base, application_id: VALID_UUID_3 })
    expect(result.success).toBe(true)
  })

  it('accepts optional interviewer_id as uuid', () => {
    const result = InterviewSchema.safeParse({ ...base, interviewer_id: VALID_UUID_3 })
    expect(result.success).toBe(true)
  })

  it('accepts null application_id (optional)', () => {
    const result = InterviewSchema.safeParse({ ...base, application_id: null })
    expect(result.success).toBe(true)
  })
})

// ─── candidate_id / vacancy_id ────────────────────────────────────────────────

describe('InterviewSchema — candidate_id and vacancy_id', () => {
  it('rejects invalid candidate_id (not a UUID)', () => {
    const result = InterviewSchema.safeParse({ ...base, candidate_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid vacancy_id (not a UUID)', () => {
    const result = InterviewSchema.safeParse({ ...base, vacancy_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing candidate_id', () => {
    const { candidate_id: _, ...rest } = base
    expect(InterviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing vacancy_id', () => {
    const { vacancy_id: _, ...rest } = base
    expect(InterviewSchema.safeParse(rest).success).toBe(false)
  })
})

// ─── scheduled_at ────────────────────────────────────────────────────────────

describe('InterviewSchema — scheduled_at (must be in the future)', () => {
  it('accepts a scheduled_at 1 hour in the future', () => {
    const result = InterviewSchema.safeParse({ ...base, scheduled_at: futureDate })
    expect(result.success).toBe(true)
  })

  it('rejects a scheduled_at 1 hour in the past', () => {
    const result = InterviewSchema.safeParse({ ...base, scheduled_at: pastDate })
    expect(result.success).toBe(false)
  })

  it('rejects a scheduled_at that is not a parseable date string', () => {
    const result = InterviewSchema.safeParse({ ...base, scheduled_at: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('rejects missing scheduled_at', () => {
    const { scheduled_at: _, ...rest } = base
    expect(InterviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty scheduled_at string', () => {
    const result = InterviewSchema.safeParse({ ...base, scheduled_at: '' })
    expect(result.success).toBe(false)
  })

  it('future refinement error is reported on scheduled_at path', () => {
    const result = InterviewSchema.safeParse({ ...base, scheduled_at: pastDate })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('scheduled_at')
    }
  })
})

// ─── duration_minutes ─────────────────────────────────────────────────────────

describe('InterviewSchema — duration_minutes', () => {
  it('accepts 15 (boundary min)', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 15 })
    expect(result.success).toBe(true)
  })

  it('accepts 60 (default)', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 60 })
    expect(result.success).toBe(true)
  })

  it('accepts 480 (boundary max — 8 hours)', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 480 })
    expect(result.success).toBe(true)
  })

  it('rejects 14 (below min)', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 14 })
    expect(result.success).toBe(false)
  })

  it('rejects 481 (above max)', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 481 })
    expect(result.success).toBe(false)
  })

  it('rejects 0', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative value', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: -30 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer value', () => {
    const result = InterviewSchema.safeParse({ ...base, duration_minutes: 30.5 })
    expect(result.success).toBe(false)
  })

  it('defaults to 60 when omitted', () => {
    const { duration_minutes: _, ...rest } = base
    const result = InterviewSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.duration_minutes).toBe(60)
  })
})

// ─── type enum ────────────────────────────────────────────────────────────────

describe('InterviewSchema — type enum', () => {
  it('accepts phone', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'phone' }).success).toBe(true)
  })

  it('accepts video', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'video' }).success).toBe(true)
  })

  it('accepts onsite', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'onsite' }).success).toBe(true)
  })

  it('rejects unknown type value', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'carrier_pigeon' }).success).toBe(false)
  })

  it('rejects uppercase type (case-sensitive)', () => {
    expect(InterviewSchema.safeParse({ ...base, type: 'VIDEO' }).success).toBe(false)
  })

  it('rejects missing type', () => {
    const { type: _, ...rest } = base
    expect(InterviewSchema.safeParse(rest).success).toBe(false)
  })
})

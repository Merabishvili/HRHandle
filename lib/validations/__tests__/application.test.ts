import { describe, it, expect } from 'vitest'
import { ApplicationSchema } from '@/lib/validations/application'

const VALID_UUID = '11111111-1111-1111-1111-111111111111'
const VALID_UUID_2 = '22222222-2222-2222-2222-222222222222'

describe('ApplicationSchema', () => {
  it('accepts the minimal valid payload (candidate_id + vacancy_id only)', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a full payload', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      pipeline_stage_id: VALID_UUID,
      notes: 'Strong candidate',
    })
    expect(result.success).toBe(true)
  })

  it('allows null pipeline_stage_id', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      pipeline_stage_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('allows null notes', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      notes: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID candidate_id with the documented message', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: 'not-a-uuid',
      vacancy_id: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Invalid candidate')
    }
  })

  it('rejects a non-UUID vacancy_id with the documented message', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe('Invalid vacancy')
    }
  })

  it('rejects a non-UUID pipeline_stage_id', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      pipeline_stage_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes longer than 2000 chars', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      notes: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('accepts notes at exactly 2000 chars', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
      vacancy_id: VALID_UUID_2,
      notes: 'x'.repeat(2000),
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing candidate_id', () => {
    const result = ApplicationSchema.safeParse({
      vacancy_id: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing vacancy_id', () => {
    const result = ApplicationSchema.safeParse({
      candidate_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { WITHDRAWAL_REASON_MAX, withdrawalReason } from '@/lib/applications/withdrawal'

describe('withdrawalReason', () => {
  it('keeps what the candidate wrote, trimmed', () => {
    expect(withdrawalReason('  Took another offer.  ')).toBe('Took another offer.')
  })

  it('treats empty or missing text as no reason', () => {
    expect(withdrawalReason('   ')).toBeNull()
    expect(withdrawalReason(null)).toBeNull()
    expect(withdrawalReason(undefined)).toBeNull()
  })

  it('caps very long text', () => {
    expect(withdrawalReason('x'.repeat(WITHDRAWAL_REASON_MAX + 50))).toHaveLength(WITHDRAWAL_REASON_MAX)
  })
})

import { describe, it, expect } from 'vitest'
import {
  statusCodeToBucket,
  DEFAULT_BUCKET_VIEW,
  STEPPER_BUCKETS,
  BUCKETS,
} from '@/lib/application-status-bucket'

describe('statusCodeToBucket', () => {
  it('maps applied → Applied (step 0, non-terminal)', () => {
    const view = statusCodeToBucket('applied')
    expect(view.bucket).toBe('applied')
    expect(view.label).toBe('Applied')
    expect(view.stepIndex).toBe(0)
    expect(view.isTerminal).toBe(false)
    expect(view.outcome).toBeNull()
  })

  it('maps screening → In review (step 1, non-terminal)', () => {
    const view = statusCodeToBucket('screening')
    expect(view.bucket).toBe('in_review')
    expect(view.label).toBe('In review')
    expect(view.stepIndex).toBe(1)
    expect(view.isTerminal).toBe(false)
    expect(view.outcome).toBeNull()
  })

  it('maps interview → Interview (step 2, non-terminal)', () => {
    const view = statusCodeToBucket('interview')
    expect(view.bucket).toBe('interview')
    expect(view.label).toBe('Interview')
    expect(view.stepIndex).toBe(2)
    expect(view.isTerminal).toBe(false)
    expect(view.outcome).toBeNull()
  })

  it('maps offer → Decision (step 3, non-terminal — no outcome reveal)', () => {
    const view = statusCodeToBucket('offer')
    expect(view.bucket).toBe('decision')
    expect(view.label).toBe('Decision')
    expect(view.stepIndex).toBe(3)
    expect(view.isTerminal).toBe(false)
    expect(view.outcome).toBeNull()
  })

  it('maps hired → Decision (terminal, outcome=hired)', () => {
    const view = statusCodeToBucket('hired')
    expect(view.bucket).toBe('decision')
    expect(view.label).toBe('Decision')
    expect(view.stepIndex).toBe(3)
    expect(view.isTerminal).toBe(true)
    expect(view.outcome).toBe('hired')
  })

  it('maps rejected → Closed (terminal, NO outcome reveal — page should not deliver a rejection)', () => {
    const view = statusCodeToBucket('rejected')
    expect(view.bucket).toBe('closed')
    expect(view.label).toBe('Closed')
    expect(view.stepIndex).toBe(4)
    expect(view.isTerminal).toBe(true)
    expect(view.outcome).toBeNull()
    // Subtitle must not say "rejected" / "not selected" / similar.
    expect(view.subtitle.toLowerCase()).not.toMatch(/reject|not selected|unsuccessful/)
  })

  it('maps withdrawn → Closed (terminal, outcome=withdrawn)', () => {
    const view = statusCodeToBucket('withdrawn')
    expect(view.bucket).toBe('closed')
    expect(view.label).toBe('Closed')
    expect(view.stepIndex).toBe(4)
    expect(view.isTerminal).toBe(true)
    expect(view.outcome).toBe('withdrawn')
  })

  it('falls back to Applied for unknown / null / undefined codes', () => {
    expect(statusCodeToBucket(null)).toEqual(DEFAULT_BUCKET_VIEW)
    expect(statusCodeToBucket(undefined)).toEqual(DEFAULT_BUCKET_VIEW)
    expect(statusCodeToBucket('something_else')).toEqual(DEFAULT_BUCKET_VIEW)
    expect(statusCodeToBucket('')).toEqual(DEFAULT_BUCKET_VIEW)
  })
})

describe('STEPPER_BUCKETS', () => {
  it('contains exactly the four non-terminal candidate-facing steps in order', () => {
    expect(STEPPER_BUCKETS.map((s) => s.bucket)).toEqual([
      'applied',
      'in_review',
      'interview',
      'decision',
    ])
  })

  it('does not include "closed" — closed cases are rendered out-of-band', () => {
    expect(STEPPER_BUCKETS.find((s) => s.bucket === 'closed')).toBeUndefined()
  })
})

describe('BUCKETS', () => {
  it('contains all five buckets', () => {
    expect(BUCKETS).toEqual(['applied', 'in_review', 'interview', 'decision', 'closed'])
  })
})

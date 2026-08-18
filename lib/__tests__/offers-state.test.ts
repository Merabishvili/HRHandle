import { describe, it, expect } from 'vitest'
import {
  OFFER_STATUSES,
  TERMINAL_STATUSES,
  isTerminal,
  canEdit,
  canSend,
  canWithdraw,
  canRespond,
  type OfferStatus,
} from '@/lib/offers/state'

describe('offer status set', () => {
  it('contains all six valid statuses in the documented order', () => {
    expect(OFFER_STATUSES).toEqual([
      'draft',
      'sent',
      'accepted',
      'declined',
      'expired',
      'withdrawn',
    ])
  })

  it('marks the terminal statuses correctly', () => {
    expect([...TERMINAL_STATUSES]).toEqual(
      expect.arrayContaining(['accepted', 'declined', 'expired', 'withdrawn']),
    )
    expect(TERMINAL_STATUSES.has('draft' as OfferStatus)).toBe(false)
    expect(TERMINAL_STATUSES.has('sent' as OfferStatus)).toBe(false)
  })

  it('isTerminal matches TERMINAL_STATUSES', () => {
    for (const s of OFFER_STATUSES) {
      expect(isTerminal(s)).toBe(TERMINAL_STATUSES.has(s))
    }
  })
})

describe('recruiter-side guards', () => {
  it('canEdit is true only for draft', () => {
    expect(canEdit('draft')).toBe(true)
    expect(canEdit('sent')).toBe(false)
    expect(canEdit('accepted')).toBe(false)
    expect(canEdit('declined')).toBe(false)
    expect(canEdit('expired')).toBe(false)
    expect(canEdit('withdrawn')).toBe(false)
  })

  it('canSend is true only for draft', () => {
    expect(canSend('draft')).toBe(true)
    expect(canSend('sent')).toBe(false)
    expect(canSend('accepted')).toBe(false)
  })

  it('canWithdraw is true only for sent', () => {
    expect(canWithdraw('draft')).toBe(false)
    expect(canWithdraw('sent')).toBe(true)
    expect(canWithdraw('accepted')).toBe(false)
    expect(canWithdraw('declined')).toBe(false)
    expect(canWithdraw('expired')).toBe(false)
    expect(canWithdraw('withdrawn')).toBe(false)
  })
})

describe('candidate-side guard', () => {
  it('canRespond is true only for sent', () => {
    expect(canRespond('sent')).toBe(true)
    expect(canRespond('draft')).toBe(false)
    expect(canRespond('accepted')).toBe(false)
    expect(canRespond('declined')).toBe(false)
    expect(canRespond('expired')).toBe(false)
    expect(canRespond('withdrawn')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import {
  isTerminal,
  canEdit,
  canSend,
  canWithdraw,
  canRespond,
  OFFER_STATUSES,
  TERMINAL_STATUSES,
  type OfferStatus,
} from '@/lib/offers/state'

describe('offer state machine', () => {
  it('marks accepted/declined/expired/withdrawn as terminal, draft/sent as not', () => {
    expect(isTerminal('accepted')).toBe(true)
    expect(isTerminal('declined')).toBe(true)
    expect(isTerminal('expired')).toBe(true)
    expect(isTerminal('withdrawn')).toBe(true)
    expect(isTerminal('draft')).toBe(false)
    expect(isTerminal('sent')).toBe(false)
  })

  it('only a draft can be edited or sent', () => {
    for (const s of OFFER_STATUSES) {
      expect(canEdit(s)).toBe(s === 'draft')
      expect(canSend(s)).toBe(s === 'draft')
    }
  })

  it('only a sent offer can be withdrawn (recruiter) or responded to (candidate)', () => {
    for (const s of OFFER_STATUSES) {
      expect(canWithdraw(s)).toBe(s === 'sent')
      expect(canRespond(s)).toBe(s === 'sent')
    }
  })

  it('a terminal offer is neither editable, sendable, withdrawable, nor respondable', () => {
    for (const s of [...TERMINAL_STATUSES] as OfferStatus[]) {
      expect(canEdit(s) || canSend(s) || canWithdraw(s) || canRespond(s)).toBe(false)
    }
  })
})

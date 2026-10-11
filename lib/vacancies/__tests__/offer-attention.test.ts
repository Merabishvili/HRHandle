import { describe, it, expect } from 'vitest'
import { offerAttention } from '@/lib/vacancies/offer-attention'

const now = Date.parse('2026-10-10T12:00:00Z')

describe('offerAttention', () => {
  it('counts the days since a sent offer is waiting for an answer', () => {
    expect(offerAttention([{ status: 'sent', sent_at: '2026-10-07T09:00:00Z' }], now)).toEqual({ kind: 'awaiting', daysAwaiting: 3 })
  })

  it('asks to create an offer when none was sent yet', () => {
    expect(offerAttention([], now)).toEqual({ kind: 'none' })
  })

  it('asks to create a new offer after a decline', () => {
    expect(offerAttention([{ status: 'declined', sent_at: '2026-10-01T09:00:00Z' }], now)).toEqual({ kind: 'none' })
  })

  it('points at an unsent draft', () => {
    expect(offerAttention([{ status: 'draft', sent_at: null }], now)).toEqual({ kind: 'draft' })
  })

  it('says nothing once the offer is accepted', () => {
    expect(offerAttention([{ status: 'accepted', sent_at: '2026-10-01T09:00:00Z' }], now)).toBeNull()
  })
})

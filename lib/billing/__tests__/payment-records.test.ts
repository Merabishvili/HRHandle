import { describe, it, expect } from 'vitest'
import {
  cardLast4,
  clientIp,
  formatAmountMinor,
  hasReceipt,
  paymentRowStatus,
  retainUntil,
  safeMaskedCard,
  transactionDetails,
} from '../payment-records'
import type { FlittCallback } from '@/lib/flitt/types'

const NOW = new Date('2026-10-23T12:00:00Z')

function cb(over: Partial<FlittCallback> = {}): FlittCallback {
  return {
    order_id: 'hrh_x',
    order_status: 'approved',
    amount: '4900',
    currency: 'GEL',
    merchant_id: 1234567,
    ...over,
  }
}

describe('retainUntil', () => {
  it('adds five calendar years', () => {
    expect(retainUntil(NOW).toISOString()).toBe('2031-10-23T12:00:00.000Z')
  })
})

describe('safeMaskedCard', () => {
  it('keeps masked numbers', () => {
    expect(safeMaskedCard('444455XXXXXX1111')).toBe('444455XXXXXX1111')
    expect(safeMaskedCard('4444 55** **** 1111')).toBe('4444 55** **** 1111')
  })
  it('never keeps a full card number', () => {
    expect(safeMaskedCard('4444555566661111')).toBeNull()
    expect(safeMaskedCard('4444X55566661111')).toBeNull()
  })
  it('drops junk', () => {
    expect(safeMaskedCard(undefined)).toBeNull()
    expect(safeMaskedCard('')).toBeNull()
    expect(safeMaskedCard(42)).toBeNull()
  })
})

describe('cardLast4', () => {
  it('reads the last four digits', () => {
    expect(cardLast4('444455XXXXXX1111')).toBe('1111')
    expect(cardLast4(null)).toBeNull()
  })
})

describe('transactionDetails', () => {
  it('keeps receipt fields and sets retention', () => {
    const d = transactionDetails(
      cb({ masked_card: '444455XXXXXX1111', card_type: 'VISA', rrn: '123456789012', approval_code: '027440', sender_email: 'a@b.c' }),
      NOW,
    )
    expect(d).toEqual({
      masked_card: '444455XXXXXX1111',
      card_type: 'VISA',
      rrn: '123456789012',
      approval_code: '027440',
      paid_at: NOW.toISOString(),
      retain_until: '2031-10-23T12:00:00.000Z',
    })
    expect(JSON.stringify(d)).not.toContain('a@b.c')
  })

  it('records a refund, without a paid date on a reversal', () => {
    const d = transactionDetails(cb({ order_status: 'reversed', reversal_amount: '4900' }), NOW)
    expect(d.reversal_amount_minor).toBe(4900)
    expect(d.reversed_at).toBe(NOW.toISOString())
    expect(d.paid_at).toBeUndefined()
  })

  it('falls back to payment_system for the card type', () => {
    expect(transactionDetails(cb({ payment_system: 'mastercard' }), NOW).card_type).toBe('mastercard')
  })
})

describe('paymentRowStatus / hasReceipt', () => {
  it('maps statuses', () => {
    expect(paymentRowStatus({ status: 'approved', amount_minor: 100 })).toBe('paid')
    expect(paymentRowStatus({ status: 'approved', amount_minor: 100, reversal_amount_minor: 40 })).toBe('partly_refunded')
    expect(paymentRowStatus({ status: 'approved', amount_minor: 100, reversal_amount_minor: 100 })).toBe('refunded')
    expect(paymentRowStatus({ status: 'reversed', amount_minor: 100 })).toBe('refunded')
    expect(paymentRowStatus({ status: 'declined', amount_minor: 100 })).toBe('failed')
    expect(paymentRowStatus({ status: 'pending', amount_minor: 100 })).toBeNull()
  })
  it('gives receipts to charged rows only', () => {
    expect(hasReceipt('approved')).toBe(true)
    expect(hasReceipt('reversed')).toBe(true)
    expect(hasReceipt('declined')).toBe(false)
  })
})

describe('formatAmountMinor', () => {
  it('formats with the currency symbol', () => {
    expect(formatAmountMinor(4900, 'GEL')).toBe('₾49.00')
    expect(formatAmountMinor(1250, 'USD')).toBe('$12.50')
    expect(formatAmountMinor(100, 'XYZ')).toBe('1.00 XYZ')
  })
})

describe('clientIp', () => {
  it('takes the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8')
    expect(clientIp(new Headers())).toBeNull()
  })
})

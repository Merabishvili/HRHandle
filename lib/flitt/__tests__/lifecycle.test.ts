import { describe, it, expect } from 'vitest'
import {
  addPeriod,
  decideCallback,
  findParentOrderId,
  isStopConfirmed,
  paymentIdOf,
  type StoredOrder,
} from '../lifecycle'
import type { FlittCallback } from '../types'

const ROOT = 'hrh_0123456789ab_individual_monthly_1760000000000'
const NOW = new Date('2026-10-08T12:00:00Z')

function order(over: Partial<StoredOrder> = {}): StoredOrder {
  return {
    order_id: ROOT,
    billing_cycle: 'monthly',
    currency: 'GEL',
    amount_minor: 4900,
    status: 'pending',
    flitt_payment_id: null,
    ...over,
  }
}

function cb(over: Partial<FlittCallback> = {}): FlittCallback {
  return {
    order_id: ROOT,
    order_status: 'approved',
    amount: '4900',
    currency: 'GEL',
    merchant_id: 4056901,
    payment_id: '111',
    ...over,
  }
}

describe('findParentOrderId', () => {
  it('returns null for our own root order id', () => {
    expect(findParentOrderId({ order_id: ROOT })).toBeNull()
  })
  it('detects a renewal reported under a derived order id', () => {
    expect(findParentOrderId({ order_id: `${ROOT}_2` })).toBe(ROOT)
  })
  it('prefers an explicit parent_order_id', () => {
    expect(findParentOrderId({ order_id: 'flitt-xyz', parent_order_id: ROOT })).toBe(ROOT)
  })
  it('ignores unrelated order ids', () => {
    expect(findParentOrderId({ order_id: 'something_else' })).toBeNull()
  })
})

describe('addPeriod', () => {
  it('adds a month for monthly and a year for annual', () => {
    expect(addPeriod(NOW, 'monthly').toISOString()).toBe('2026-11-08T12:00:00.000Z')
    expect(addPeriod(NOW, 'annual').toISOString()).toBe('2027-10-08T12:00:00.000Z')
  })
})

describe('paymentIdOf', () => {
  it('normalizes numeric ids to strings and empty to null', () => {
    expect(paymentIdOf({ payment_id: 123 as unknown as string })).toBe('123')
    expect(paymentIdOf({ payment_id: '' })).toBeNull()
    expect(paymentIdOf({})).toBeNull()
  })
})

describe('decideCallback', () => {
  const base = { isChildOrder: false, currentPeriodEnd: null, now: NOW }

  it('activates a first payment from now', () => {
    const d = decideCallback({ ...base, order: order(), cb: cb() })
    expect(d).toEqual({
      kind: 'activate',
      renewal: false,
      periodStart: NOW,
      periodEnd: new Date('2026-11-08T12:00:00Z'),
    })
  })

  it('ignores an exact retry of an applied event', () => {
    const d = decideCallback({
      ...base,
      order: order({ status: 'approved', flitt_payment_id: '111' }),
      cb: cb(),
    })
    expect(d).toEqual({ kind: 'ignore', reason: 'duplicate' })
  })

  it('treats a new approved payment on the same order id as a renewal from the period end', () => {
    const periodEnd = new Date('2026-10-10T12:00:00Z')
    const d = decideCallback({
      ...base,
      currentPeriodEnd: periodEnd,
      order: order({ status: 'approved', flitt_payment_id: '111' }),
      cb: cb({ payment_id: '222' }),
    })
    expect(d).toEqual({
      kind: 'activate',
      renewal: true,
      periodStart: periodEnd,
      periodEnd: new Date('2026-11-10T12:00:00Z'),
    })
  })

  it('renews a child order from now when the period already lapsed', () => {
    const d = decideCallback({
      ...base,
      isChildOrder: true,
      currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
      order: order({ order_id: `${ROOT}_2` }),
      cb: cb({ order_id: `${ROOT}_2`, payment_id: '333' }),
    })
    expect(d).toMatchObject({ kind: 'activate', renewal: true, periodStart: NOW })
  })

  it('marks past_due on a declined renewal', () => {
    const d = decideCallback({
      ...base,
      order: order({ status: 'approved', flitt_payment_id: '111' }),
      cb: cb({ order_status: 'declined', payment_id: '222' }),
    })
    expect(d).toEqual({ kind: 'past_due' })
  })

  it('only records a declined first payment', () => {
    const d = decideCallback({ ...base, order: order(), cb: cb({ order_status: 'declined' }) })
    expect(d).toEqual({ kind: 'record' })
  })

  it('treats a reversal as a full refund (ends the plan)', () => {
    const d = decideCallback({
      ...base,
      order: order({ status: 'approved', flitt_payment_id: '111' }),
      cb: cb({ order_status: 'reversed' }),
    })
    expect(d).toEqual({ kind: 'refund', full: true })
  })

  it('uses reversal_amount to tell full from partial refunds', () => {
    const approved = order({ status: 'approved', flitt_payment_id: '111' })
    expect(
      decideCallback({ ...base, order: approved, cb: cb({ order_status: 'reversed', reversal_amount: '4900' }) }),
    ).toEqual({ kind: 'refund', full: true })
    expect(
      decideCallback({ ...base, order: approved, cb: cb({ order_status: 'reversed', reversal_amount: '1000' }) }),
    ).toEqual({ kind: 'refund', full: false })
  })

  it('catches a partial refund that keeps the approved status (not a retry)', () => {
    const d = decideCallback({
      ...base,
      order: order({ status: 'approved', flitt_payment_id: '111' }),
      cb: cb({ order_status: 'approved', reversal_amount: '1000' }),
    })
    expect(d).toEqual({ kind: 'refund', full: false })
  })

  it('re-applies a resent full refund (idempotent, not deduped)', () => {
    const d = decideCallback({
      ...base,
      order: order({ status: 'reversed', flitt_payment_id: '111' }),
      cb: cb({ order_status: 'reversed' }),
    })
    expect(d).toEqual({ kind: 'refund', full: true })
  })

  it('rejects an amount or currency mismatch', () => {
    expect(decideCallback({ ...base, order: order(), cb: cb({ amount: '100' }) })).toEqual({
      kind: 'ignore',
      reason: 'tamper',
    })
    expect(decideCallback({ ...base, order: order(), cb: cb({ currency: 'USD' }) })).toEqual({
      kind: 'ignore',
      reason: 'tamper',
    })
  })
})

describe('isStopConfirmed', () => {
  it('confirms a successful stop', () => {
    expect(isStopConfirmed({ response_status: 'success', status: 'stopped' })).toBe(true)
    expect(isStopConfirmed({ response_status: 'success' })).toBe(true)
  })
  it('rejects a reply that leaves the subscription active or failed', () => {
    expect(isStopConfirmed({ response_status: 'success', status: 'active' })).toBe(false)
    expect(isStopConfirmed({ response_status: 'failure', status: 'stopped' })).toBe(false)
    expect(isStopConfirmed(undefined)).toBe(false)
  })
})

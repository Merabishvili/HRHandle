import { describe, it, expect } from 'vitest'
import { parseCsv, parseRegister, reconcile, toMinor, type LedgerRow } from '../reconcile'

describe('parseCsv', () => {
  it('handles quotes, semicolons and CRLF', () => {
    expect(parseCsv('a;b\r\n"x;1";"he said ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'he said "hi"'],
    ])
  })
})

describe('toMinor', () => {
  it('reads decimals as major units and integers as minor units', () => {
    expect(toMinor('49.00')).toBe(4900)
    expect(toMinor('49,5')).toBe(4950)
    expect(toMinor('4900')).toBe(4900)
    expect(toMinor('49', 'major')).toBe(4900)
    expect(toMinor('')).toBeNull()
  })
})

describe('parseRegister', () => {
  it('maps known headers in any case', () => {
    const rows = parseRegister('Order ID,Status,Amount,Currency\nhrh_1,Approved,49.00,gel\n')
    expect(rows).toEqual([{ order_id: 'hrh_1', status: 'approved', amount_minor: 4900, currency: 'GEL', reversal_minor: null }])
  })
  it('fails loudly without an order id column', () => {
    expect(() => parseRegister('foo,bar\n1,2\n')).toThrow(/order id/)
  })
})

describe('reconcile', () => {
  const ledger: LedgerRow[] = [
    { order_id: 'a', status: 'approved', amount_minor: 4900, currency: 'GEL' },
    { order_id: 'b', status: 'pending', amount_minor: 4900, currency: 'GEL' },
    { order_id: 'c', status: 'approved', amount_minor: 4900, currency: 'GEL' },
    { order_id: 'd', status: 'approved', amount_minor: 4900, currency: 'GEL' },
    { order_id: 'a:pay2', status: 'approved', amount_minor: 4900, currency: 'GEL' },
  ]

  it('finds every kind of gap', () => {
    const issues = reconcile(
      [
        { order_id: 'a', status: 'approved', amount_minor: 4900, currency: 'GEL', reversal_minor: null },
        { order_id: 'b', status: 'approved', amount_minor: 4900, currency: 'GEL', reversal_minor: null },
        { order_id: 'c', status: 'approved', amount_minor: 3900, currency: 'GEL', reversal_minor: 1000 },
        { order_id: 'x', status: 'approved', amount_minor: 100, currency: 'GEL', reversal_minor: null },
      ],
      ledger,
    )
    expect(issues.map((i) => `${i.kind}:${i.order_id}`).sort()).toEqual([
      'amount_mismatch:c',
      'missing_in_ledger:x',
      'missing_in_register:d',
      'not_activated:b',
      'refund_not_recorded:c',
    ])
  })

  it('is quiet when everything matches', () => {
    expect(
      reconcile([{ order_id: 'a', status: 'approved', amount_minor: 4900, currency: 'GEL', reversal_minor: null }], [ledger[0]!]),
    ).toEqual([])
  })
})

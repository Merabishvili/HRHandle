import { describe, it, expect } from 'vitest'
import { resolveBillingCurrency, toMinorUnits } from '@/lib/pricing/currency'
import { getPlanMonthly, getPlanChargeTotal, PRICING_PLANS } from '@/lib/types/subscription'

describe('resolveBillingCurrency', () => {
  it('Georgia → GEL (legal display requirement)', () => {
    expect(resolveBillingCurrency('GE')).toBe('GEL')
    expect(resolveBillingCurrency('ge')).toBe('GEL')
  })
  it('EU/EEA country → EUR', () => {
    expect(resolveBillingCurrency('DE')).toBe('EUR')
    expect(resolveBillingCurrency('fr')).toBe('EUR')
    expect(resolveBillingCurrency('NO')).toBe('EUR')
  })
  it('US / non-EU → USD', () => {
    expect(resolveBillingCurrency('US')).toBe('USD')
    expect(resolveBillingCurrency('BR')).toBe('USD')
    expect(resolveBillingCurrency('GB')).toBe('USD')
  })
  it('null / empty / unknown → USD', () => {
    expect(resolveBillingCurrency(null)).toBe('USD')
    expect(resolveBillingCurrency('')).toBe('USD')
    expect(resolveBillingCurrency(undefined)).toBe('USD')
  })
  it('explicit override wins over country', () => {
    expect(resolveBillingCurrency('GE', 'USD')).toBe('USD')
    expect(resolveBillingCurrency('US', 'GEL')).toBe('GEL')
  })
  it('invalid override is ignored (falls back to country)', () => {
    expect(resolveBillingCurrency('GE', 'XXX')).toBe('GEL')
    expect(resolveBillingCurrency('GE', '')).toBe('GEL')
  })
})

describe('toMinorUnits', () => {
  it('multiplies by 100 and rounds', () => {
    expect(toMinorUnits(49)).toBe(4900)
    expect(toMinorUnits(15.5)).toBe(1550)
    expect(toMinorUnits(0)).toBe(0)
  })
})

describe('plan price getters', () => {
  const individual = PRICING_PLANS.find((p) => p.code === 'individual')!
  const trial = PRICING_PLANS.find((p) => p.code === 'trial')!

  it('returns monthly vs annual per currency', () => {
    expect(getPlanMonthly(individual, 'GEL', 'monthly')).toBe(49)
    expect(getPlanMonthly(individual, 'GEL', 'annual')).toBe(39)
    expect(getPlanMonthly(individual, 'USD', 'monthly')).toBe(20)
    expect(getPlanMonthly(individual, 'EUR', 'annual')).toBe(15)
  })
  it('annual charge total is 12× the per-month annual rate', () => {
    expect(getPlanChargeTotal(individual, 'GEL', 'annual')).toBe(39 * 12)
    expect(getPlanChargeTotal(individual, 'GEL', 'monthly')).toBe(49)
  })
  it('trial has no price in any currency', () => {
    expect(getPlanMonthly(trial, 'GEL', 'monthly')).toBeNull()
    expect(getPlanChargeTotal(trial, 'USD', 'annual')).toBeNull()
  })
})

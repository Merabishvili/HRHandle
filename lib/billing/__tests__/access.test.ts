import { describe, it, expect } from 'vitest'
import {
  canViewBilling,
  displaySubscriptionStatus,
  isSubscriptionLocked,
  RENEWAL_GRACE_DAYS,
  shouldRedirectToBilling,
} from '../access'

const NOW = new Date('2026-10-08T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString()

function sub(over: Partial<Parameters<typeof isSubscriptionLocked>[0] & object> = {}) {
  return {
    status: 'active',
    trial_end_at: null,
    current_period_end_at: iso(10),
    next_billing_at: iso(10),
    ...over,
  }
}

describe('isSubscriptionLocked', () => {
  it('never locks without a subscription', () => {
    expect(isSubscriptionLocked(null, NOW)).toBe(false)
  })

  it('locks an expired status', () => {
    expect(isSubscriptionLocked(sub({ status: 'expired' }), NOW)).toBe(true)
  })

  it('locks a trial only after trial_end_at', () => {
    expect(isSubscriptionLocked(sub({ status: 'trial', trial_end_at: iso(1) }), NOW)).toBe(false)
    expect(isSubscriptionLocked(sub({ status: 'trial', trial_end_at: iso(-1) }), NOW)).toBe(true)
  })

  it('keeps an active plan inside its period', () => {
    expect(isSubscriptionLocked(sub(), NOW)).toBe(false)
  })

  it('gives an auto-renewing plan the grace period after the period end', () => {
    const ended = { current_period_end_at: iso(-1), next_billing_at: iso(-1) }
    expect(isSubscriptionLocked(sub({ ...ended, status: 'past_due' }), NOW)).toBe(false)
    const pastGrace = {
      current_period_end_at: iso(-(RENEWAL_GRACE_DAYS + 1)),
      next_billing_at: iso(-(RENEWAL_GRACE_DAYS + 1)),
    }
    expect(isSubscriptionLocked(sub({ ...pastGrace, status: 'past_due' }), NOW)).toBe(true)
    expect(isSubscriptionLocked(sub(pastGrace), NOW)).toBe(true)
  })

  it('locks a canceled auto-renew right at the period end (no grace)', () => {
    expect(
      isSubscriptionLocked(sub({ current_period_end_at: iso(-1), next_billing_at: null }), NOW),
    ).toBe(true)
    expect(
      isSubscriptionLocked(sub({ current_period_end_at: iso(1), next_billing_at: null }), NOW),
    ).toBe(false)
  })

  it('never locks a plan without a period end (manual / complimentary)', () => {
    expect(
      isSubscriptionLocked(sub({ current_period_end_at: null, next_billing_at: null }), NOW),
    ).toBe(false)
  })
})

describe('displaySubscriptionStatus', () => {
  it('shows expired for a locked paid plan whatever is stored', () => {
    const ended = { current_period_end_at: iso(-1), next_billing_at: null }
    expect(displaySubscriptionStatus({ ...sub(ended), plan_code: 'individual' }, NOW)).toBe('expired')
  })
  it('keeps the stored status while the plan is usable', () => {
    expect(displaySubscriptionStatus({ ...sub({ status: 'past_due' }), plan_code: 'individual' }, NOW)).toBe(
      'past_due',
    )
  })
  it('leaves trials to their own trial badge', () => {
    const trial = sub({ status: 'trial', trial_end_at: iso(-1) })
    expect(displaySubscriptionStatus({ ...trial, plan_code: 'trial' }, NOW)).toBe('trial')
  })
})

describe('canViewBilling', () => {
  it('lets owners and admins in always', () => {
    expect(canViewBilling('owner', false)).toBe(true)
    expect(canViewBilling('admin', false)).toBe(true)
  })
  it('lets members in only while the org is locked (no redirect loop)', () => {
    expect(canViewBilling('member', false)).toBe(false)
    expect(canViewBilling('member', true)).toBe(true)
  })
})

describe('shouldRedirectToBilling', () => {
  it('sends a locked org to billing from other pages', () => {
    expect(shouldRedirectToBilling(true, '/pipeline')).toBe(true)
    expect(shouldRedirectToBilling(true, '/settings')).toBe(true)
  })
  it('never redirects from billing itself (the redirect loop)', () => {
    expect(shouldRedirectToBilling(true, '/settings/billing')).toBe(false)
    expect(shouldRedirectToBilling(true, '/subscription')).toBe(false)
  })
  it('fails open when the path is unknown instead of looping', () => {
    expect(shouldRedirectToBilling(true, '')).toBe(false)
  })
  it('never redirects an unlocked org', () => {
    expect(shouldRedirectToBilling(false, '/pipeline')).toBe(false)
  })
})

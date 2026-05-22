import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isCampaignActive, getCampaignPrice, CAMPAIGN } from '@/lib/campaign'

describe('isCampaignActive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true before the campaign end date', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(isCampaignActive()).toBe(true)
  })

  it('returns false exactly on the campaign end date (strict less-than)', () => {
    vi.setSystemTime(new Date(CAMPAIGN.endDate + 'T00:00:00Z'))
    expect(isCampaignActive()).toBe(false)
  })

  it('returns false after the campaign end date', () => {
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    expect(isCampaignActive()).toBe(false)
  })
})

describe('getCampaignPrice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies monthly discount when campaign is active', () => {
    // CAMPAIGN.discounts.monthly = 0.60 → price * 0.40
    expect(getCampaignPrice(20, 'monthly')).toBe(8)
  })

  it('applies annual discount when campaign is active', () => {
    // CAMPAIGN.discounts.annual = 0.70 → price * 0.30
    expect(getCampaignPrice(40, 'annual')).toBe(12)
  })

  it('rounds to two decimal places', () => {
    // 33.33 * 0.40 = 13.332 → 13.33
    expect(getCampaignPrice(33.33, 'monthly')).toBe(13.33)
  })

  it('returns base price unchanged when campaign is over', () => {
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    expect(getCampaignPrice(20, 'monthly')).toBe(20)
    expect(getCampaignPrice(40, 'annual')).toBe(40)
  })

  it('handles zero correctly', () => {
    expect(getCampaignPrice(0, 'monthly')).toBe(0)
  })
})

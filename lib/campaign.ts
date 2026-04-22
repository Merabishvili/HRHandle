export interface Campaign {
  active: boolean
  name: string
  endDate: string
  discounts: {
    monthly: number
    annual: number
  }
}

export const CAMPAIGN: Campaign = {
  active: true,
  name: 'Spring Offer',
  endDate: '2026-06-01',
  discounts: {
    monthly: 0.60,
    annual: 0.70,
  },
}

export function isCampaignActive(): boolean {
  if (!CAMPAIGN.active) return false
  return new Date() < new Date(CAMPAIGN.endDate)
}

export function getCampaignPrice(basePrice: number, cycle: 'monthly' | 'annual'): number {
  if (!isCampaignActive()) return basePrice
  const discount = CAMPAIGN.discounts[cycle]
  return Math.round(basePrice * (1 - discount) * 100) / 100
}

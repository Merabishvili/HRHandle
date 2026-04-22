'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Zap } from 'lucide-react'
import type { PricingPlan } from '@/lib/types/subscription'
import type { Campaign } from '@/lib/campaign'
import { getCampaignPrice } from '@/lib/campaign'

interface PricingSectionProps {
  plans: PricingPlan[]
  campaign: Campaign
  campaignActive: boolean
}

export function PricingSection({ plans, campaign, campaignActive }: PricingSectionProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  const annualDiscount = Math.round(campaign.discounts.annual * 100)
  const monthlyDiscount = Math.round(campaign.discounts.monthly * 100)

  return (
    <div>
      {campaignActive && (
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700">
            <Zap className="h-4 w-4" />
            🌸 {campaign.name} — special pricing until{' '}
            {new Date(campaign.endDate).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      )}

      <div className="mb-10 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-muted p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all ${
              billing === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
            {campaignActive && (
              <span className="ml-2 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                -{monthlyDiscount}%
              </span>
            )}
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all ${
              billing === 'annual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Annual
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
              campaignActive ? 'bg-orange-500' : 'bg-green-500'
            }`}>
              -{campaignActive ? annualDiscount : 20}%
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {plans.map((plan) => {
          const isTrial = plan.code === 'trial'

          const basePrice = billing === 'annual' ? plan.price_annual : plan.price_monthly
          const displayPrice = campaignActive && basePrice
            ? getCampaignPrice(basePrice, billing)
            : basePrice
          const originalPrice = campaignActive ? basePrice : null

          return (
            <Card
              key={plan.code}
              className={`relative border-border ${
                plan.popular ? 'border-2 border-primary shadow-lg' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground whitespace-nowrap">
                  Most Popular
                </div>
              )}

              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>

                <div className="mt-4 min-h-[72px]">
                  {isTrial ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">Free</span>
                        <span className="text-muted-foreground"> / 7 days</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">No credit card required</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-foreground">
                          ${displayPrice}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                        {campaignActive && originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            ${originalPrice}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {billing === 'annual' ? 'billed annually' : 'billed monthly'}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  asChild
                >
                  <Link href="/auth/sign-up">
                    {isTrial ? 'Start Free Trial' : 'Get Started'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

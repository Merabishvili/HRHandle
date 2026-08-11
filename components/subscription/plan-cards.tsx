'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap } from 'lucide-react'
import type { PricingPlan, PlanCode, BillingCycle } from '@/lib/types/subscription'
import { getPlanMonthly } from '@/lib/types/subscription'
import { CURRENCY_SYMBOL, type Currency } from '@/lib/pricing/currency'
import { startPlanCheckout } from '@/lib/actions/billing'
import type { Campaign } from '@/lib/campaign'
import { getCampaignPrice } from '@/lib/campaign'

interface PlanCardsProps {
  plans: PricingPlan[]
  currentPlanCode: string
  currency: Currency
  campaign: Campaign
  campaignActive: boolean
}

export function PlanCards({ plans, currentPlanCode, currency, campaign, campaignActive }: PlanCardsProps) {
  const t = useTranslations()
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [pendingCode, setPendingCode] = useState<PlanCode | null>(null)
  const [, startTransition] = useTransition()

  const symbol = CURRENCY_SYMBOL[currency]
  const annualDiscount = Math.round(campaign.discounts.annual * 100)
  const monthlyDiscount = Math.round(campaign.discounts.monthly * 100)

  const handleUpgrade = (code: PlanCode) => {
    setPendingCode(code)
    startTransition(async () => {
      const res = await startPlanCheckout({ planCode: code, cycle: billing })
      if (res.success) {
        window.location.href = res.data.checkoutUrl
      } else {
        toast.error(res.error)
        setPendingCode(null)
      }
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{t('planCards.availablePlans')}</h2>

        <div className="inline-flex items-center rounded-full border border-border bg-muted p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              billing === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('planCards.monthly')}
            {campaignActive && (
              <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                -{monthlyDiscount}%
              </span>
            )}
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              billing === 'annual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('planCards.annual')}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
              campaignActive ? 'bg-orange-500' : 'bg-green-500'
            }`}>
              -{campaignActive ? annualDiscount : 20}%
            </span>
          </button>
        </div>
      </div>

      {campaignActive && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
          <Zap className="h-4 w-4 shrink-0" />
          {t('planCards.campaignBanner', {
            name: campaign.name,
            date: new Date(campaign.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          })}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode
          const isTrial = plan.code === 'trial'

          const basePrice = getPlanMonthly(plan, currency, billing)
          const displayPrice = campaignActive && basePrice
            ? getCampaignPrice(basePrice, billing)
            : basePrice
          const originalPrice = campaignActive ? basePrice : null

          return (
            <Card
              key={plan.code}
              className={`relative border-border ${
                plan.popular ? 'border-2 border-primary shadow-lg' : ''
              } ${isCurrent ? 'bg-muted/30' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  {t('planCards.mostPopular')}
                </div>
              )}

              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                  {isCurrent && <Badge variant="secondary">{t('planCards.current')}</Badge>}
                </div>

                <div className="mb-6 min-h-[60px]">
                  {isTrial ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">{t('planCards.free')}</span>
                        <span className="text-muted-foreground">{t('planCards.per7days')}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{t('planCards.noCard')}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">
                          {symbol}{displayPrice}
                        </span>
                        <span className="text-muted-foreground">{t('planCards.perMo')}</span>
                        {campaignActive && originalPrice && (
                          <span className="text-sm text-muted-foreground line-through">
                            {symbol}{originalPrice}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {billing === 'annual' ? t('planCards.billedAnnually') : t('planCards.billedMonthly')}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                  disabled={isCurrent || isTrial || pendingCode !== null}
                  onClick={() => !isCurrent && !isTrial && handleUpgrade(plan.code)}
                >
                  {pendingCode === plan.code && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {isCurrent ? t('planCards.currentPlan') : isTrial ? t('planCards.trialPlan') : t('planCards.upgrade')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

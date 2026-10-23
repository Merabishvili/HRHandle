'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES, CURRENCY_LABEL, type Currency } from '@/lib/pricing/currency'
import type { BillingCycle } from '@/lib/types/subscription'
import { PAYMENT_PROVIDER_BRAND } from '@/lib/legal/payment-provider'

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The plan's display name ("Organization"). */
  planLabel: string
  cycle: BillingCycle
  /** True while the org hasn't answered the Georgian-residency question:
   * the dialog asks it first (nothing preselected). */
  askResidency: boolean
  /** Currency the org pays in today (used when the residency is answered). */
  currency: Currency
  /** Currency a non-resident starts with (the page's resolved non-resident one). */
  nonResidentCurrency: Currency
  /** "₾49/mo · billed monthly"-style line for the chosen plan in a currency. */
  priceLine: (currency: Currency) => string
  pending: boolean
  /** `geResident`/`currency` are only meaningful when `askResidency` is true. */
  onConfirm: (choice: { geResident: boolean | null; currency: Currency }) => void
}

/**
 * Opens from every Upgrade, before the payment page. Shows the plan, the final
 * price and how renewal works, and asks for explicit agreement to the Terms,
 * the Refund Policy and automatic renewal charges — stored with the order as
 * the customer's consent (the evidence if a charge is ever disputed). While the
 * org hasn't answered the Georgian-residency question it is asked here first
 * (residents: GEL only, by Georgian law; non-residents: pick GEL/EUR/USD).
 */
export function CheckoutDialog({
  open,
  onOpenChange,
  planLabel,
  cycle,
  askResidency,
  currency: currentCurrency,
  nonResidentCurrency,
  priceLine,
  pending,
  onConfirm,
}: CheckoutDialogProps) {
  const t = useTranslations('billingResidency')
  const tc = useTranslations('checkout')
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)
  const [currency, setCurrency] = useState<Currency>(nonResidentCurrency)
  const [agreed, setAgreed] = useState(false)
  const finalCurrency: Currency = !askResidency
    ? currentCurrency
    : answer === 'yes'
      ? 'GEL'
      : currency
  const showSummary = !askResidency || answer !== null
  const canContinue = showSummary && agreed && !pending

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{askResidency ? t('dialogTitle') : tc('title')}</DialogTitle>
          <DialogDescription>{askResidency ? t('dialogWhy') : tc('subtitle')}</DialogDescription>
        </DialogHeader>

        {askResidency && (
          <div>
            <p id="ge-residency-dialog-label" className="text-sm font-medium text-foreground">
              {t('question')}
            </p>
            <RadioGroup
              value={answer}
              onValueChange={(v) => setAnswer(v as 'yes' | 'no')}
              disabled={pending}
              aria-labelledby="ge-residency-dialog-label"
              aria-required
              className="mt-3 flex flex-wrap gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="ge-residency-dialog-yes" />
                <Label htmlFor="ge-residency-dialog-yes">{t('yes')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="ge-residency-dialog-no" />
                <Label htmlFor="ge-residency-dialog-no">{t('no')}</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {askResidency && answer === 'no' && (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ge-residency-dialog-currency" className="text-sm text-muted-foreground">
              {t('payIn')}
            </Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={pending}>
              <SelectTrigger id="ge-residency-dialog-currency" className="h-8 w-auto min-w-[88px] gap-1.5 text-sm font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{CURRENCY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showSummary && (
          <div className="space-y-1.5 rounded-lg bg-muted px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              {planLabel} · {t('youPay', { price: priceLine(finalCurrency) })}
            </p>
            {askResidency && answer === 'yes' && (
              <p className="text-muted-foreground">{t('residentNote')}</p>
            )}
            <p className="text-muted-foreground">
              {tc(cycle === 'annual' ? 'renewAnnual' : 'renewMonthly')}
            </p>
          </div>
        )}

        {showSummary && (
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="checkout-consent"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              disabled={pending}
              className="mt-0.5"
            />
            <Label htmlFor="checkout-consent" className="text-sm font-normal leading-snug text-foreground">
              {tc.rich('consent', {
                terms: (c) => <a href="/terms" target="_blank" className="underline">{c}</a>,
                refund: (c) => <a href="/refund" target="_blank" className="underline">{c}</a>,
              })}
            </Label>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {tc('securePage', { provider: PAYMENT_PROVIDER_BRAND })}{' '}
            {askResidency && (
              <>
                {t('lockNote')}{' '}
                {t.rich('termsNote', { terms: (c) => <a href="/terms" target="_blank" className="underline">{c}</a> })}
              </>
            )}
          </span>
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() =>
              canContinue &&
              onConfirm({
                geResident: askResidency ? answer === 'yes' : null,
                currency: finalCurrency,
              })
            }
            disabled={!canContinue}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {t('continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

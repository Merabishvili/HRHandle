'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface ResidencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Currency a non-resident starts with (the page's resolved non-resident one). */
  nonResidentCurrency: Currency
  /** "₾49/mo, billed monthly"-style line for the chosen plan in a currency. */
  priceLine: (currency: Currency) => string
  pending: boolean
  onConfirm: (geResident: boolean, currency: Currency) => void
}

/**
 * Opens from Upgrade when the org hasn't answered the Georgian-residency
 * question yet. Nothing is preselected; once answered it shows the final price
 * (residents: GEL only, by Georgian law; non-residents: pick GEL/EUR/USD) before
 * going on to the payment page.
 */
export function ResidencyDialog({
  open,
  onOpenChange,
  nonResidentCurrency,
  priceLine,
  pending,
  onConfirm,
}: ResidencyDialogProps) {
  const t = useTranslations('billingResidency')
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null)
  const [currency, setCurrency] = useState<Currency>(nonResidentCurrency)
  const finalCurrency: Currency = answer === 'yes' ? 'GEL' : currency

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogWhy')}</DialogDescription>
        </DialogHeader>

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

        {answer === 'no' && (
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

        {answer !== null && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{t('youPay', { price: priceLine(finalCurrency) })}</p>
            {answer === 'yes' && <p className="mt-1 text-muted-foreground">{t('residentNote')}</p>}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('lockNote')}{' '}
          {t.rich('termsNote', { terms: (c) => <a href="/terms" target="_blank" className="underline">{c}</a> })}
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button onClick={() => answer && onConfirm(answer === 'yes', finalCurrency)} disabled={answer === null || pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {t('continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

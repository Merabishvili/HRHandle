'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { setBillingResidency } from '@/lib/actions/billing'

interface ResidencyCardProps {
  /** Saved answer; `null` = not answered yet, so neither option is selected. */
  geResident: boolean | null
  /** True after the org's first successful payment: read-only, support changes it. */
  locked: boolean
}

/**
 * Settings → Organization: the Georgian-residency answer ("I am a resident of
 * Georgia (individual or legal entity)" yes/no). Editable until the first
 * successful payment, then read-only (`isResidencyLocked`). Residents are
 * charged in GEL only (Georgian law). Saved on change, audited.
 */
export function ResidencyCard({ geResident, locked }: ResidencyCardProps) {
  const t = useTranslations('billingResidency')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const value = geResident === null ? null : geResident ? 'yes' : 'no'

  const onChange = (next: string) => {
    startTransition(async () => {
      const res = await setBillingResidency(next === 'yes')
      if (res.success) router.refresh()
      else toast.error(res.error)
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>{t('dialogWhy')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p id="ge-residency-label" className="text-sm font-medium text-foreground">
          {t('question')}
        </p>
        <RadioGroup
          value={value}
          onValueChange={onChange}
          disabled={pending || locked}
          aria-labelledby="ge-residency-label"
          className="mt-3 flex flex-wrap gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="ge-residency-yes" />
            <Label htmlFor="ge-residency-yes">{t('yes')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="ge-residency-no" />
            <Label htmlFor="ge-residency-no">{t('no')}</Label>
          </div>
        </RadioGroup>
        <p className="mt-3 text-xs text-muted-foreground">
          {locked ? (
            <span className="inline-flex items-start gap-1.5">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                {t.rich('lockedNote', {
                  support: (c) => <a href="/settings/support" className="underline">{c}</a>,
                })}
              </span>
            </span>
          ) : (
            <>
              {geResident === null ? t('required') : geResident ? t('residentNote') : t('nonResidentNote')}{' '}
              {t('lockNote')}
            </>
          )}{' '}
          {t.rich('termsNote', { terms: (c) => <a href="/terms" className="underline">{c}</a> })}
        </p>
      </CardContent>
    </Card>
  )
}

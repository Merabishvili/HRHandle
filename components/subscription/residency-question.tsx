'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { setBillingResidency } from '@/lib/actions/billing'

interface ResidencyQuestionProps {
  /** Saved answer; `null` = not answered yet, so neither option is selected. */
  geResident: boolean | null
  canManage: boolean
}

/**
 * Required "I am a resident of Georgia (individual or legal entity)" yes/no on
 * the billing page. Nothing is preselected and checkout stays disabled until it
 * is answered: residents are charged in GEL only (Georgian law), non-residents
 * may pick EUR or USD. Saved on change via `setBillingResidency` (audited).
 */
export function ResidencyQuestion({ geResident, canManage }: ResidencyQuestionProps) {
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
    <section
      className={`mb-6 rounded-xl border px-5 py-4 ${
        geResident === null ? 'border-amber-300 bg-amber-50/60' : 'border-border'
      }`}
    >
      <p id="ge-residency-label" className="text-sm font-medium text-foreground">
        {t('question')} <span className="text-red-600" aria-hidden>*</span>
      </p>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={pending || !canManage}
        aria-labelledby="ge-residency-label"
        aria-required
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
        {geResident === null ? t('required') : geResident ? t('residentNote') : t('nonResidentNote')}{' '}
        {t.rich('termsNote', { terms: (c) => <a href="/terms" className="underline">{c}</a> })}
      </p>
    </section>
  )
}

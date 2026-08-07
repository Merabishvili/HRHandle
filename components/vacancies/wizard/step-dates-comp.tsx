'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface DatesCompState {
  startDate: string | null
  endDate: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
}

interface StepDatesCompProps {
  value: DatesCompState
  onChange: (next: DatesCompState) => void
}

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'GEL']

/**
 * Wave 2.7 wizard — Step 2 / Dates & compensation per Create Vacancy
 * Steps.dc.html. Both dates and salary range are optional. The wizard
 * orchestrator defaults `startDate` to today on submit to satisfy the
 * existing schema constraint (tech-debt.md §1 tracks the schema relax).
 */
export function StepDatesComp({ value, onChange }: StepDatesCompProps) {
  const t = useTranslations()
  const set = <K extends keyof DatesCompState>(key: K, v: DatesCompState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">{t('wizard.stepDates')}</h2>
        <p className="text-[12.5px] text-muted-foreground">{t('wizard.datesSubtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="start_date" label={t('columns.startDate')}>
          <Input
            id="start_date"
            type="date"
            value={value.startDate ?? ''}
            onChange={(e) => set('startDate', e.target.value || null)}
          />
        </Field>
        <Field id="end_date" label={t('columns.endDate')}>
          <Input
            id="end_date"
            type="date"
            value={value.endDate ?? ''}
            onChange={(e) => set('endDate', e.target.value || null)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_110px]">
        <Field id="salary_min" label={t('vacancy.form.minSalary')}>
          <Input
            id="salary_min"
            type="number"
            inputMode="numeric"
            min={0}
            value={value.salaryMin ?? ''}
            onChange={(e) => set('salaryMin', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="50000"
          />
        </Field>
        <Field id="salary_max" label={t('vacancy.form.maxSalary')}>
          <Input
            id="salary_max"
            type="number"
            inputMode="numeric"
            min={0}
            value={value.salaryMax ?? ''}
            onChange={(e) => set('salaryMax', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="80000"
          />
        </Field>
        <Field id="currency" label={t('vacancy.form.currency')}>
          <Select
            value={value.salaryCurrency}
            onValueChange={(v) => set('salaryCurrency', v)}
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        {t('wizard.salaryHint')}
      </p>
    </div>
  )
}

function Field({
  id,
  label,
  subtitle,
  children,
}: {
  id: string
  label: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11.5px] font-medium text-muted-foreground">
        {label}
        {subtitle && <span className="ml-1 text-[10.5px] font-semibold">{subtitle}</span>}
      </Label>
      {children}
    </div>
  )
}

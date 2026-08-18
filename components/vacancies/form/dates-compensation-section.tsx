'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import type { VacancyFormValues } from '@/lib/validations/vacancy'

interface DatesCompensationSectionProps {
  form: UseFormReturn<VacancyFormValues>
  disabled: boolean
}

export function DatesCompensationSection({ form, disabled }: DatesCompensationSectionProps) {
  const t = useTranslations()
  const {
    control,
    formState: { errors },
  } = form

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('vacancy.form.datesComp')}</CardTitle>
        <CardDescription>{t('vacancy.form.datesCompDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div id="field-start_date" className="space-y-2">
            <Label>{t('columns.startDate')} *</Label>
            <Controller
              control={control}
              name="start_date"
              render={({ field }) => (
                <DatePicker
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  placeholder={t('vacancy.form.selectStartDate')}
                  disabled={disabled}
                  fromYear={2020}
                  toYear={2035}
                />
              )}
            />
            {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
          </div>

          <div id="field-end_date" className="space-y-2">
            <Label>{t('columns.endDate')}</Label>
            <Controller
              control={control}
              name="end_date"
              render={({ field }) => (
                <DatePicker
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? null)}
                  placeholder={t('vacancy.form.selectEndDate')}
                  disabled={disabled}
                  fromYear={2020}
                  toYear={2035}
                />
              )}
            />
            {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="salary_min">{t('vacancy.form.minSalary')}</Label>
            <Controller
              control={control}
              name="salary_min"
              render={({ field }) => (
                <Input
                  id="salary_min"
                  type="number"
                  placeholder="50000"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  onBlur={field.onBlur}
                  disabled={disabled}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary_max">{t('vacancy.form.maxSalary')}</Label>
            <Controller
              control={control}
              name="salary_max"
              render={({ field }) => (
                <Input
                  id="salary_max"
                  type="number"
                  placeholder="80000"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  onBlur={field.onBlur}
                  disabled={disabled}
                />
              )}
            />
            {errors.salary_max && <p className="text-xs text-destructive">{errors.salary_max.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary_currency">{t('vacancy.form.currency')}</Label>
            <Controller
              control={control}
              name="salary_currency"
              render={({ field }) => (
                <Select value={field.value || 'USD'} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger id="salary_currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="GEL">GEL</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

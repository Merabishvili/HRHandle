'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiJdSuggest } from '@/components/vacancies/ai-jd-suggest'
import { AiBiasCheck } from '@/components/vacancies/ai-bias-check'
import type { JdSection } from '@/lib/ai/jd-generator'
import type { VacancyFormValues } from '@/lib/validations/vacancy'
import type { Sector } from '@/lib/types'

interface DetailsSectionProps {
  form: UseFormReturn<VacancyFormValues>
  sectors: Sector[]
  disabled: boolean
}

export function DetailsSection({ form, sectors, disabled }: DetailsSectionProps) {
  const {
    control,
    register,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form

  const t = useTranslations()
  const description = watch('description')
  const responsibilities = watch('responsibilities')
  const requirements = watch('requirements')

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('vacancy.form.details')}</CardTitle>
        <CardDescription>{t('vacancy.form.detailsDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <AiJdSuggest
          getFormSnapshot={() => {
            const v = getValues()
            return {
              title: v.title,
              department: v.department || null,
              location: v.location || null,
              employment_type: v.employment_type ?? null,
              sector_name: sectors.find((s) => s.id === v.sector_id)?.name ?? null,
            }
          }}
          getExistingFieldText={(section: JdSection) => {
            const v = getValues()
            return section === 'description'
              ? v.description
              : section === 'responsibilities'
                ? v.responsibilities
                : v.requirements
          }}
          onApplyAll={(generated) => {
            if (generated.description !== undefined) {
              setValue('description', generated.description, { shouldDirty: true })
            }
            if (generated.responsibilities !== undefined) {
              setValue('responsibilities', generated.responsibilities, { shouldDirty: true })
            }
            if (generated.requirements !== undefined) {
              setValue('requirements', generated.requirements, { shouldDirty: true })
            }
          }}
        />

        <AiBiasCheck
          getFormSnapshot={() => {
            const v = getValues()
            return {
              description: v.description,
              responsibilities: v.responsibilities,
              requirements: v.requirements,
            }
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="description">{t('vacancy.form.aboutJob')} *</Label>
          <Textarea
            id="description"
            placeholder={t('vacancy.form.aboutPlaceholder')}
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('description')}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          <p className="text-xs text-muted-foreground text-right">{(description || '').length} / 5000</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsibilities">{t('vacancy.form.responsibilities')}</Label>
          <Textarea
            id="responsibilities"
            placeholder={t('vacancy.form.respPlaceholder')}
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('responsibilities')}
          />
          <p className="text-xs text-muted-foreground text-right">{(responsibilities || '').length} / 5000</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="requirements">{t('vacancy.form.requirements')}</Label>
          <Textarea
            id="requirements"
            placeholder={t('vacancy.form.reqPlaceholder')}
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('requirements')}
          />
          <p className="text-xs text-muted-foreground text-right">{(requirements || '').length} / 5000</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="show_on_public_page" className="text-sm font-medium">{t('vacancy.form.showOnPublic')}</Label>
            <p className="text-xs text-muted-foreground">{t('vacancy.form.showOnPublicHelp')}</p>
          </div>
          <Controller
            control={control}
            name="show_on_public_page"
            render={({ field }) => (
              <Switch
                id="show_on_public_page"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}

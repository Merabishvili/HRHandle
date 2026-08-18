'use client'

import { useState } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiJdSuggest } from '@/components/vacancies/ai-jd-suggest'
import { AiBiasCheck } from '@/components/vacancies/ai-bias-check'
import { LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { cn } from '@/lib/utils'
import type { JdSection } from '@/lib/ai/jd-generator'
import type { VacancyFormValues } from '@/lib/validations/vacancy'
import type { Sector } from '@/lib/types'

type BodyField = 'description' | 'responsibilities' | 'requirements'

interface DetailsSectionProps {
  form: UseFormReturn<VacancyFormValues>
  sectors: Sector[]
  disabled: boolean
  /** Org content languages — when >1, a per-language tab bar appears (Slice 4). */
  orgLocales?: { default: Locale; enabled: Locale[] }
  translations?: Record<string, { description: string; responsibilities: string; requirements: string }>
  onTranslationChange?: (locale: string, field: BodyField, value: string) => void
}

export function DetailsSection({
  form,
  sectors,
  disabled,
  orgLocales = { default: DEFAULT_LOCALE, enabled: [DEFAULT_LOCALE] },
  translations = {},
  onTranslationChange,
}: DetailsSectionProps) {
  const t = useTranslations()
  const {
    control,
    register,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form

  const description = watch('description')
  const responsibilities = watch('responsibilities')
  const requirements = watch('requirements')

  const multiLocale = orgLocales.enabled.length > 1
  const [activeLocale, setActiveLocale] = useState<Locale>(orgLocales.default)
  // The default locale is edited via the RHF fields; other locales via `translations`.
  const isDefault = activeLocale === orgLocales.default
  const tr = translations[activeLocale] ?? { description: '', responsibilities: '', requirements: '' }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('vacancy.form.details')}</CardTitle>
        <CardDescription>{t('vacancy.form.detailsDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {multiLocale && (
          <div className="flex flex-wrap gap-1.5">
            {orgLocales.enabled.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setActiveLocale(l)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeLocale === l
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {LOCALE_LABELS[l]}
                {l === orgLocales.default && <span className="ml-1 opacity-60">· {t('settings.orgLang.defaultTag')}</span>}
              </button>
            ))}
          </div>
        )}

        {isDefault ? (
          <>
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
          </>
        ) : (
          // Non-default locale — plain per-locale textareas (optional; AI assist
          // + validation apply only to the default-locale content above).
          <>
            <div className="space-y-2">
              <Label>{t('vacancy.form.aboutJob')}</Label>
              <Textarea
                value={tr.description}
                onChange={(e) => onTranslationChange?.(activeLocale, 'description', e.target.value)}
                disabled={disabled}
                rows={5}
                maxLength={5000}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('vacancy.form.responsibilities')}</Label>
              <Textarea
                value={tr.responsibilities}
                onChange={(e) => onTranslationChange?.(activeLocale, 'responsibilities', e.target.value)}
                disabled={disabled}
                rows={5}
                maxLength={5000}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('vacancy.form.requirements')}</Label>
              <Textarea
                value={tr.requirements}
                onChange={(e) => onTranslationChange?.(activeLocale, 'requirements', e.target.value)}
                disabled={disabled}
                rows={5}
                maxLength={5000}
              />
            </div>
          </>
        )}

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

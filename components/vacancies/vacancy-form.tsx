'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm, type SubmitHandler, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createVacancy, updateVacancy, deleteVacancy } from '@/lib/actions/vacancies'
import { saveCustomFieldValues } from '@/lib/actions/custom-fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { CustomFieldsForm, valuesToMap, mapToValueUpserts } from '@/components/custom-fields/custom-fields-form'
import { BasicInfoSection } from '@/components/vacancies/form/basic-info-section'
import { DatesCompensationSection } from '@/components/vacancies/form/dates-compensation-section'
import { DetailsSection } from '@/components/vacancies/form/details-section'
import {
  VacancyFormSchema,
  WORK_MODE_NONE,
  type VacancyFormValues,
} from '@/lib/validations/vacancy'
import { DEFAULT_LOCALE, type Locale, type LocalizedText } from '@/lib/i18n/locales'
import type { Vacancy, Sector, VacancyStatus } from '@/lib/types'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

/** Per-locale body content for the locales OTHER than the org default (the
 * default locale is edited through the RHF fields). i18n Slice 4. */
export type BodyTranslations = Record<string, { description: string; responsibilities: string; requirements: string }>

interface VacancyFormProps {
  vacancy?: Vacancy
  sectors: Sector[]
  statusOptions: VacancyStatus[]
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
  isDuplicated?: boolean
  /** Org content-language settings — drives the per-language JD tabs. */
  orgLocales?: { default: Locale; enabled: Locale[] }
  /** Existing per-locale JD content (edit mode). */
  initialI18n?: { description: LocalizedText; responsibilities: LocalizedText; requirements: LocalizedText }
  /** Org members for the hiring-manager picker (UI shows name, stores the id). */
  orgMembers?: { id: string; full_name: string | null }[]
}

// Maps each RHF field name to the DOM id used for scroll-to-error on submit.
// DatePicker wrappers carry the id on their surrounding div (field-*), native
// inputs / SelectTriggers carry it directly.
const FIELD_IDS: Record<string, string> = {
  title: 'title',
  start_date: 'field-start_date',
  description: 'description',
  sector_id: 'sector_id',
  status_id: 'status_id',
  openings_count: 'openings_count',
  salary_max: 'salary_max',
  end_date: 'field-end_date',
}
// Priority mirrors the old hand-written validateForm order, so the user lands
// on the same "first" problem field they did before the RHF migration.
const ERROR_PRIORITY = [
  'title',
  'start_date',
  'description',
  'sector_id',
  'status_id',
  'openings_count',
  'salary_max',
  'end_date',
]

export function VacancyForm({
  vacancy,
  sectors,
  statusOptions,
  customFieldGroups = [],
  customFieldValues = [],
  isDuplicated = false,
  orgLocales = { default: DEFAULT_LOCALE, enabled: [DEFAULT_LOCALE] },
  initialI18n,
  orgMembers = [],
}: VacancyFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfValues, setCfValues] = useState<Record<string, string>>(
    () => valuesToMap(customFieldValues)
  )

  // i18n Slice 4 — locales other than the org default get their own JD content
  // via the language tabs; the default locale is edited through the RHF fields.
  const extraLocales = orgLocales.enabled.filter((l) => l !== orgLocales.default)
  const [translations, setTranslations] = useState<BodyTranslations>(() => {
    const seed: BodyTranslations = {}
    for (const l of extraLocales) {
      seed[l] = {
        description: initialI18n?.description?.[l] ?? '',
        responsibilities: initialI18n?.responsibilities?.[l] ?? '',
        requirements: initialI18n?.requirements?.[l] ?? '',
      }
    }
    return seed
  })

  const form = useForm<VacancyFormValues>({
    resolver: zodResolver(VacancyFormSchema),
    defaultValues: {
      title: vacancy?.title ?? '',
      sector_id: vacancy?.sector_id ?? '',
      status_id: vacancy?.status_id ?? '',
      department: vacancy?.department ?? '',
      location: vacancy?.location ?? '',
      employment_type: vacancy?.employment_type ?? 'full_time',
      work_mode: vacancy?.work_mode ?? WORK_MODE_NONE,
      hiring_manager_name: vacancy?.hiring_manager_name ?? '',
      hiring_manager_id: vacancy?.hiring_manager_id ?? null,
      salary_min: vacancy?.salary_min ?? null,
      salary_max: vacancy?.salary_max ?? null,
      salary_currency: vacancy?.salary_currency ?? 'USD',
      openings_count: vacancy?.openings_count ?? 1,
      start_date: vacancy?.start_date ?? '',
      end_date: vacancy?.end_date ?? null,
      description: vacancy?.description ?? '',
      responsibilities: vacancy?.responsibilities ?? '',
      requirements: vacancy?.requirements ?? '',
      show_on_public_page: vacancy?.show_on_public_page ?? false,
    },
  })

  /**
   * On a validation failure: show a toast (visible regardless of scroll
   * position), set the persistent error Alert at the top, and scroll the
   * offending field into view + focus it so the user lands directly on the
   * problem. Preserves the pre-RHF UX.
   */
  const reportValidationError = (message: string, fieldId: string | undefined) => {
    setError(message)
    toast.error(message)
    if (typeof window === 'undefined' || !fieldId) return
    const el = document.getElementById(fieldId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      const focusable = el.matches('input, textarea, button, select')
        ? (el as HTMLElement)
        : el.querySelector<HTMLElement>('input, textarea, button, select')
      focusable?.focus({ preventScroll: true })
    }, 350)
  }

  const onInvalid = (errors: FieldErrors<VacancyFormValues>) => {
    for (const key of ERROR_PRIORITY) {
      const fieldError = errors[key as keyof VacancyFormValues]
      if (fieldError?.message) {
        reportValidationError(String(fieldError.message), FIELD_IDS[key])
        return
      }
    }
  }

  const onValid: SubmitHandler<VacancyFormValues> = async (values) => {
    setError(null)
    setIsLoading(true)

    // i18n Slice 4 — assemble the per-locale JD objects: the default locale
    // comes from the RHF field, the other locales from `translations`. Empty
    // strings are omitted so pickLocale falls back cleanly.
    const buildI18n = (field: 'description' | 'responsibilities' | 'requirements'): Record<string, string> => {
      const out: Record<string, string> = {}
      const def = (values[field] ?? '').trim()
      if (def) out[orgLocales.default] = def
      for (const l of extraLocales) {
        const v = (translations[l]?.[field] ?? '').trim()
        if (v) out[l] = v
      }
      return out
    }
    const description_i18n = buildI18n('description')
    const responsibilities_i18n = buildI18n('responsibilities')
    const requirements_i18n = buildI18n('requirements')
    const posting_locales = [
      orgLocales.default,
      ...extraLocales.filter((l) => description_i18n[l] || responsibilities_i18n[l] || requirements_i18n[l]),
    ]

    const payload = {
      title: values.title, // schema trims
      sector_id: values.sector_id,
      status_id: values.status_id,
      department: values.department.trim() || null,
      location: values.location.trim() || null,
      employment_type: values.employment_type,
      work_mode: values.work_mode === WORK_MODE_NONE ? null : values.work_mode,
      hiring_manager_name: values.hiring_manager_name.trim() || null,
      hiring_manager_id: values.hiring_manager_id ?? null,
      salary_min: values.salary_min,
      salary_max: values.salary_max,
      salary_currency: values.salary_currency || 'USD',
      openings_count: values.openings_count || 1,
      start_date: values.start_date,
      end_date: values.end_date || null,
      description: values.description, // schema trims
      responsibilities: values.responsibilities.trim() || null,
      requirements: values.requirements.trim() || null,
      show_on_public_page: values.show_on_public_page,
      description_i18n,
      responsibilities_i18n,
      requirements_i18n,
      posting_locales,
    }

    let entityId: string | undefined
    if (vacancy) {
      const result = await updateVacancy(vacancy.id, payload)
      if (!result.success) {
        setError(result.error)
        toast.error(result.error)
        setIsLoading(false)
        return
      }
      entityId = vacancy.id
    } else {
      const result = await createVacancy(payload)
      if (!result.success) {
        setError(result.error)
        toast.error(result.error)
        setIsLoading(false)
        return
      }
      entityId = result.data.id
    }

    if (entityId && customFieldGroups.length > 0) {
      const upserts = mapToValueUpserts(cfValues, customFieldGroups)
      if (upserts.length > 0) {
        await saveCustomFieldValues(entityId, upserts)
      }
    }

    router.push(vacancy ? `/vacancies/${vacancy.id}` : '/vacancies')
    setIsLoading(false)
  }

  return (
    <form onSubmit={form.handleSubmit(onValid, onInvalid)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <BasicInfoSection form={form} sectors={sectors} statusOptions={statusOptions} orgMembers={orgMembers} disabled={isLoading} />
      <DatesCompensationSection form={form} disabled={isLoading} />
      <DetailsSection
        form={form}
        sectors={sectors}
        disabled={isLoading}
        orgLocales={orgLocales}
        translations={translations}
        onTranslationChange={(locale, field, value) =>
          setTranslations((prev) => ({
            ...prev,
            [locale]: { ...prev[locale], [field]: value } as BodyTranslations[string],
          }))
        }
      />

      {/* Custom Fields */}
      {customFieldGroups.length > 0 && customFieldGroups.some((g) => g.fields.length > 0) && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>{t('profile.additionalInfo')}</CardTitle>
            <CardDescription>{t('vacForm.customFieldsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CustomFieldsForm
              groups={customFieldGroups}
              values={cfValues}
              onChange={(fieldId, value) =>
                setCfValues((prev) => ({ ...prev, [fieldId]: value }))
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-4">
        {isDuplicated ? (
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={async () => {
              if (!vacancy) return
              setIsLoading(true)
              await deleteVacancy(vacancy.id)
              router.push('/vacancies')
            }}
          >
            {t('vacForm.discard')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(vacancy ? `/vacancies/${vacancy.id}` : '/vacancies')}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
        )}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isDuplicated ? t('common.saving') : vacancy ? t('candidateForm.updating') : t('vacForm.creating')}
            </>
          ) : isDuplicated ? (
            t('common.save')
          ) : vacancy ? (
            t('vacForm.updateVacancy')
          ) : (
            t('wizard.createVacancy')
          )}
        </Button>
      </div>
    </form>
  )
}

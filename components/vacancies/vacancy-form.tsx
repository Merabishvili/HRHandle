'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import type { Vacancy, Sector, VacancyStatus } from '@/lib/types'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface VacancyFormProps {
  vacancy?: Vacancy
  sectors: Sector[]
  statusOptions: VacancyStatus[]
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
  isDuplicated?: boolean
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
}: VacancyFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfValues, setCfValues] = useState<Record<string, string>>(
    () => valuesToMap(customFieldValues)
  )

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

    const payload = {
      title: values.title, // schema trims
      sector_id: values.sector_id,
      status_id: values.status_id,
      department: values.department.trim() || null,
      location: values.location.trim() || null,
      employment_type: values.employment_type,
      work_mode: values.work_mode === WORK_MODE_NONE ? null : values.work_mode,
      hiring_manager_name: values.hiring_manager_name.trim() || null,
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

      <BasicInfoSection form={form} sectors={sectors} statusOptions={statusOptions} disabled={isLoading} />
      <DatesCompensationSection form={form} disabled={isLoading} />
      <DetailsSection form={form} sectors={sectors} disabled={isLoading} />

      {/* Custom Fields */}
      {customFieldGroups.length > 0 && customFieldGroups.some((g) => g.fields.length > 0) && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Additional information</CardTitle>
            <CardDescription>Custom fields defined for vacancies.</CardDescription>
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
            Discard
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(vacancy ? `/vacancies/${vacancy.id}` : '/vacancies')}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isDuplicated ? 'Saving…' : vacancy ? 'Updating…' : 'Creating…'}
            </>
          ) : isDuplicated ? (
            'Save'
          ) : vacancy ? (
            'Update vacancy'
          ) : (
            'Create vacancy'
          )}
        </Button>
      </div>
    </form>
  )
}

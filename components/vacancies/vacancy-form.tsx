'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createVacancy, updateVacancy, deleteVacancy } from '@/lib/actions/vacancies'
import { saveCustomFieldValues } from '@/lib/actions/custom-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2 } from 'lucide-react'
import { CustomFieldsForm, valuesToMap, mapToValueUpserts } from '@/components/custom-fields/custom-fields-form'
import { AiJdSuggest } from '@/components/vacancies/ai-jd-suggest'
import type { JdSection } from '@/lib/ai/jd-generator'
import { AiBiasCheck } from '@/components/vacancies/ai-bias-check'
import type {
  Vacancy,
  VacancyFormData,
  EmploymentType,
  Sector,
  VacancyStatus,
} from '@/lib/types'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface VacancyFormProps {
  vacancy?: Vacancy
  sectors: Sector[]
  statusOptions: VacancyStatus[]
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
  isDuplicated?: boolean
}

const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
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

  const [formData, setFormData] = useState<VacancyFormData>({
    title: vacancy?.title || '',
    sector_id: vacancy?.sector_id || null,
    status_id: vacancy?.status_id || null,
    department: vacancy?.department || '',
    location: vacancy?.location || '',
    employment_type: vacancy?.employment_type || 'full_time',
    hiring_manager_name: vacancy?.hiring_manager_name || '',
    salary_min: vacancy?.salary_min ?? null,
    salary_max: vacancy?.salary_max ?? null,
    salary_currency: vacancy?.salary_currency || 'USD',
    openings_count: vacancy?.openings_count || 1,
    start_date: vacancy?.start_date || '',
    end_date: vacancy?.end_date || null,
    description: vacancy?.description || '',
    responsibilities: vacancy?.responsibilities || '',
    requirements: vacancy?.requirements || '',
    show_on_public_page: vacancy?.show_on_public_page ?? false,
  })

  /**
   * Validates the form. Returns the first error along with the DOM id of the
   * field that triggered it, so the submit handler can scroll/focus the
   * specific input instead of just dumping an error message at the top of a
   * long form (which the user might never see). Field ids match the `id=`
   * attributes on each input or wrapper.
   */
  const validateForm = (): { message: string; fieldId: string } | null => {
    if (!formData.title.trim())
      return { message: 'Job title is required.', fieldId: 'title' }
    if (!formData.start_date)
      return { message: 'Start date is required.', fieldId: 'field-start_date' }
    if (!formData.description.trim())
      return { message: 'About the job is required.', fieldId: 'description' }
    if (!formData.sector_id)
      return { message: 'Sector is required.', fieldId: 'sector_id' }
    if (!formData.status_id)
      return { message: 'Status is required.', fieldId: 'status_id' }

    if ((formData.openings_count || 0) < 1) {
      return {
        message: 'Openings count must be at least 1.',
        fieldId: 'openings_count',
      }
    }

    if (
      formData.salary_min != null &&
      formData.salary_max != null &&
      formData.salary_max < formData.salary_min
    ) {
      return {
        message: 'Maximum salary must be greater than or equal to minimum salary.',
        fieldId: 'salary_max',
      }
    }

    if (
      formData.end_date &&
      formData.start_date &&
      new Date(formData.end_date) < new Date(formData.start_date)
    ) {
      return {
        message: 'End date cannot be earlier than start date.',
        fieldId: 'field-end_date',
      }
    }

    return null
  }

  /**
   * On a validation failure: show a toast (visible regardless of scroll
   * position), set the persistent error Alert at the top, and scroll the
   * offending field into view + focus it so the user lands directly on
   * the problem. For non-native-input fields (DatePicker), the wrapper
   * div carries the id; for native inputs/SelectTriggers, the input
   * itself carries it.
   */
  const reportValidationError = (validationError: {
    message: string
    fieldId: string
  }) => {
    setError(validationError.message)
    toast.error(validationError.message)
    if (typeof window === 'undefined') return
    const el = document.getElementById(validationError.fieldId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Wait for the smooth scroll to settle before focusing, so the focus
    // ring lands in the centred position rather than scrolling further.
    setTimeout(() => {
      const focusable = el.matches('input, textarea, button, select')
        ? (el as HTMLElement)
        : el.querySelector<HTMLElement>('input, textarea, button, select')
      focusable?.focus({ preventScroll: true })
    }, 350)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      reportValidationError(validationError)
      return
    }

    setIsLoading(true)

    const payload = {
      title: formData.title.trim(),
      sector_id: formData.sector_id,
      status_id: formData.status_id,
      department: formData.department?.trim() || null,
      location: formData.location?.trim() || null,
      employment_type: formData.employment_type || null,
      hiring_manager_name: formData.hiring_manager_name?.trim() || null,
      salary_min: formData.salary_min ?? null,
      salary_max: formData.salary_max ?? null,
      salary_currency: formData.salary_currency || 'USD',
      openings_count: formData.openings_count || 1,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      description: formData.description.trim(),
      responsibilities: formData.responsibilities?.trim() || null,
      requirements: formData.requirements?.trim() || null,
      show_on_public_page: formData.show_on_public_page ?? false,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>The main details about this vacancy.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Position Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Senior Software Engineer"
              value={formData.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sector_id">Sector *</Label>
              <SearchableSelect
                id="sector_id"
                value={formData.sector_id || ''}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, sector_id: value || null })
                }
                disabled={isLoading}
                placeholder="Select sector"
                searchPlaceholder="Search sectors…"
                emptyText="No sectors found."
                options={sectors.map((sector) => ({
                  value: sector.id,
                  label: sector.name,
                  searchText: sector.name,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status_id">Status *</Label>
              <Select
                value={formData.status_id || ''}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, status_id: value || null })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="status_id">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g. Engineering"
                value={formData.department || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Tbilisi or Remote"
                value={formData.location || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="employment_type">Employment type</Label>
              <Select
                value={formData.employment_type || 'full_time'}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, employment_type: value as EmploymentType })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="employment_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openings_count">Openings count</Label>
              <Input
                id="openings_count"
                type="number"
                min={1}
                value={formData.openings_count ?? 1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    openings_count: e.target.value ? Number(e.target.value) : 1,
                  })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hiring_manager_name">Hiring manager</Label>
              <Input
                id="hiring_manager_name"
                placeholder="e.g. Nino Beridze"
                value={formData.hiring_manager_name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, hiring_manager_name: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Dates and Compensation</CardTitle>
          <CardDescription>Vacancy timeline and salary range.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div id="field-start_date" className="space-y-2">
              <Label>Start Date *</Label>
              <DatePicker
                value={formData.start_date || null}
                onChange={(v) => setFormData({ ...formData, start_date: v ?? '' })}
                placeholder="Select start date"
                disabled={isLoading}
                fromYear={2020}
                toYear={2035}
              />
            </div>

            <div id="field-end_date" className="space-y-2">
              <Label>End date</Label>
              <DatePicker
                value={formData.end_date ?? null}
                onChange={(v) => setFormData({ ...formData, end_date: v })}
                placeholder="Select end date"
                disabled={isLoading}
                fromYear={2020}
                toYear={2035}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="salary_min">Minimum salary</Label>
              <Input
                id="salary_min"
                type="number"
                placeholder="50000"
                value={formData.salary_min ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    salary_min: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_max">Maximum salary</Label>
              <Input
                id="salary_max"
                type="number"
                placeholder="80000"
                value={formData.salary_max ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({
                    ...formData,
                    salary_max: e.target.value ? Number(e.target.value) : null,
                  })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_currency">Currency</Label>
              <Select
                value={formData.salary_currency || 'USD'}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, salary_currency: value })
                }
                disabled={isLoading}
              >
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Vacancy details</CardTitle>
          <CardDescription>Shown on the public jobs page and included when sharing on LinkedIn.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <AiJdSuggest
            getFormSnapshot={() => ({
              title: formData.title,
              department: formData.department || null,
              location: formData.location || null,
              employment_type: formData.employment_type ?? null,
              sector_name:
                sectors.find((s) => s.id === formData.sector_id)?.name ?? null,
            })}
            getExistingFieldText={(section: JdSection) =>
              section === 'description'
                ? formData.description
                : section === 'responsibilities'
                  ? (formData.responsibilities ?? '')
                  : (formData.requirements ?? '')
            }
            onApplyAll={(generated) => {
              setFormData((prev) => ({
                ...prev,
                description:
                  generated.description !== undefined
                    ? generated.description
                    : prev.description,
                responsibilities:
                  generated.responsibilities !== undefined
                    ? generated.responsibilities
                    : prev.responsibilities,
                requirements:
                  generated.requirements !== undefined
                    ? generated.requirements
                    : prev.requirements,
              }))
            }}
          />

          <AiBiasCheck
            getFormSnapshot={() => ({
              description: formData.description,
              responsibilities: formData.responsibilities ?? '',
              requirements: formData.requirements ?? '',
            })}
          />

          <div className="space-y-2">
            <Label htmlFor="description">About the Job *</Label>
            <Textarea
              id="description"
              placeholder="Give an overview of the role — what the team does, what success looks like, and why someone would want to join..."
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={isLoading}
              rows={5}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{(formData.description || '').length} / 5000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsibilities">Responsibilities</Label>
            <Textarea
              id="responsibilities"
              placeholder="• Lead backend architecture decisions&#10;• Collaborate with product and design&#10;• Mentor junior engineers..."
              value={formData.responsibilities || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, responsibilities: e.target.value })
              }
              disabled={isLoading}
              rows={5}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{(formData.responsibilities || '').length} / 5000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              placeholder="• 5+ years of experience with TypeScript&#10;• Strong understanding of distributed systems&#10;• Experience with cloud infrastructure..."
              value={formData.requirements || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, requirements: e.target.value })
              }
              disabled={isLoading}
              rows={5}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{(formData.requirements || '').length} / 5000</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="show_on_public_page" className="text-sm font-medium">Show on public jobs page</Label>
              <p className="text-xs text-muted-foreground">Candidates can discover and apply to this vacancy from your public jobs page.</p>
            </div>
            <Switch
              id="show_on_public_page"
              checked={formData.show_on_public_page ?? false}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, show_on_public_page: checked })
              }
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

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
            onClick={() => router.back()}
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
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createVacancy, updateVacancy } from '@/lib/actions/vacancies'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2 } from 'lucide-react'
import type {
  Vacancy,
  VacancyFormData,
  EmploymentType,
  Sector,
  VacancyStatus,
} from '@/lib/types'

interface VacancyFormProps {
  vacancy?: Vacancy
  sectors: Sector[]
  statusOptions: VacancyStatus[]
}

const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

export function VacancyForm({ vacancy, sectors, statusOptions }: VacancyFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    requirements: vacancy?.requirements || '',
  })

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Job title is required.'
    if (!formData.start_date) return 'Start date is required.'
    if (!formData.description.trim()) return 'Description is required.'
    if (!formData.sector_id) return 'Sector is required.'
    if (!formData.status_id) return 'Status is required.'

    if ((formData.openings_count || 0) < 1) {
      return 'Openings count must be at least 1.'
    }

    if (
      formData.salary_min != null &&
      formData.salary_max != null &&
      formData.salary_max < formData.salary_min
    ) {
      return 'Maximum salary must be greater than or equal to minimum salary.'
    }

    if (
      formData.end_date &&
      formData.start_date &&
      new Date(formData.end_date) < new Date(formData.start_date)
    ) {
      return 'End date cannot be earlier than start date.'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
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
      requirements: formData.requirements?.trim() || null,
    }

    const result = vacancy
      ? await updateVacancy(vacancy.id, payload)
      : await createVacancy(payload)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push('/vacancies')
    router.refresh()
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
          <CardTitle>Basic Information</CardTitle>
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
              <Select
                value={formData.sector_id || ''}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, sector_id: value || null })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="sector_id">
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="employment_type">Employment Type</Label>
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
              <Label htmlFor="openings_count">Openings Count</Label>
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
              <Label htmlFor="hiring_manager_name">Hiring Manager</Label>
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
            <div className="space-y-2">
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

            <div className="space-y-2">
              <Label>End Date</Label>
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
              <Label htmlFor="salary_min">Minimum Salary</Label>
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
              <Label htmlFor="salary_max">Maximum Salary</Label>
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
          <CardTitle>Vacancy Details</CardTitle>
          <CardDescription>Describe the role and requirements.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, and expectations..."
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={isLoading}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              placeholder="List skills, qualifications, and experience requirements..."
              value={formData.requirements || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, requirements: e.target.value })
              }
              disabled={isLoading}
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {vacancy ? 'Updating...' : 'Creating...'}
            </>
          ) : vacancy ? (
            'Update Vacancy'
          ) : (
            'Create Vacancy'
          )}
        </Button>
      </div>
    </form>
  )
}
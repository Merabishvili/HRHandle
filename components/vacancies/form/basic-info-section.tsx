'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WORK_MODE_NONE, type VacancyFormValues } from '@/lib/validations/vacancy'
import type { EmploymentType, Sector, VacancyStatus, WorkMode } from '@/lib/types'

const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

const workModes: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

interface BasicInfoSectionProps {
  form: UseFormReturn<VacancyFormValues>
  sectors: Sector[]
  statusOptions: VacancyStatus[]
  disabled: boolean
}

export function BasicInfoSection({ form, sectors, statusOptions, disabled }: BasicInfoSectionProps) {
  const {
    control,
    register,
    formState: { errors },
  } = form

  return (
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
            disabled={disabled}
            {...register('title')}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sector_id">Sector *</Label>
            <Controller
              control={control}
              name="sector_id"
              render={({ field }) => (
                <SearchableSelect
                  id="sector_id"
                  value={field.value || ''}
                  onValueChange={(value: string) => field.onChange(value)}
                  disabled={disabled}
                  placeholder="Select sector"
                  searchPlaceholder="Search sectors…"
                  emptyText="No sectors found."
                  options={sectors.map((sector) => ({
                    value: sector.id,
                    label: sector.name,
                    searchText: sector.name,
                  }))}
                />
              )}
            />
            {errors.sector_id && <p className="text-xs text-destructive">{errors.sector_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status_id">Status *</Label>
            <Controller
              control={control}
              name="status_id"
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange} disabled={disabled}>
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
              )}
            />
            {errors.status_id && <p className="text-xs text-destructive">{errors.status_id.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" placeholder="e.g. Engineering" disabled={disabled} {...register('department')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. San Francisco or Remote"
              disabled={disabled}
              {...register('location')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="employment_type">Employment type</Label>
            <Controller
              control={control}
              name="employment_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
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
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_mode">Work mode</Label>
            <Controller
              control={control}
              name="work_mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger id="work_mode">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_MODE_NONE}>Not specified</SelectItem>
                    {workModes.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openings_count">Openings count</Label>
            <Controller
              control={control}
              name="openings_count"
              render={({ field }) => (
                <Input
                  id="openings_count"
                  type="number"
                  min={1}
                  value={field.value ?? 1}
                  onChange={(e) => field.onChange(e.target.value === '' ? 1 : Number(e.target.value))}
                  onBlur={field.onBlur}
                  disabled={disabled}
                />
              )}
            />
            {errors.openings_count && (
              <p className="text-xs text-destructive">{errors.openings_count.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hiring_manager_name">Hiring manager</Label>
            <Input
              id="hiring_manager_name"
              placeholder="e.g. Nino Beridze"
              disabled={disabled}
              {...register('hiring_manager_name')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

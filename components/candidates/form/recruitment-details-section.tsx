'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
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
import type { CandidateFormValues } from '@/lib/validations/candidate'
import type { Vacancy } from '@/lib/types'

interface RecruitmentDetailsSectionProps {
  form: UseFormReturn<CandidateFormValues>
  disabled: boolean
  isEditing: boolean
  vacancies: Pick<Vacancy, 'id' | 'title'>[]
  selectedVacancyId: string
  onSelectedVacancyChange: (id: string) => void
}

export function RecruitmentDetailsSection({
  form,
  disabled,
  isEditing,
  vacancies,
  selectedVacancyId,
  onSelectedVacancyChange,
}: RecruitmentDetailsSectionProps) {
  const { control } = form

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Recruitment details</CardTitle>
        <CardDescription>Source and initial vacancy assignment.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`grid gap-4 ${isEditing ? '' : 'sm:grid-cols-2'}`}>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                  disabled={disabled}
                >
                  <SelectTrigger id="source">
                    <SelectValue placeholder="How did they enter the pipeline?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Indeed">Indeed</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Company Website">Company Website</SelectItem>
                    <SelectItem value="Job Board">Job Board</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="initial_vacancy_id">Initial vacancy</Label>
              <SearchableSelect
                id="initial_vacancy_id"
                value={selectedVacancyId || 'none'}
                onValueChange={(value) => onSelectedVacancyChange(value === 'none' ? '' : value)}
                disabled={disabled}
                placeholder="Select a vacancy (optional)"
                searchPlaceholder="Search vacancies…"
                emptyText="No vacancies found."
                options={[
                  { value: 'none', label: 'No vacancy assigned' },
                  ...vacancies.map((vacancy) => ({
                    value: vacancy.id,
                    label: vacancy.title,
                    searchText: vacancy.title,
                  })),
                ]}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

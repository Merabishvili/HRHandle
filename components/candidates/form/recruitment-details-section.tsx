'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
  const { control } = form

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('candWizard.application.recruitmentDetails')}</CardTitle>
        <CardDescription>{t('candidateForm.recruitmentDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`grid gap-4 ${isEditing ? '' : 'sm:grid-cols-2'}`}>
          <div className="space-y-2">
            <Label htmlFor="source">{t('candWizard.application.sourceLabel')}</Label>
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
                    <SelectValue placeholder={t('candidateForm.sourcePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('candWizard.application.notSpecified')}</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Indeed">Indeed</SelectItem>
                    <SelectItem value="Referral">{t('candWizard.application.srcReferral')}</SelectItem>
                    <SelectItem value="Company Website">{t('candWizard.application.srcCompanyWebsite')}</SelectItem>
                    <SelectItem value="Job Board">{t('candWizard.application.srcJobBoard')}</SelectItem>
                    <SelectItem value="Other">{t('candWizard.application.srcOther')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="initial_vacancy_id">{t('candWizard.application.initialVacancy')}</Label>
              <SearchableSelect
                id="initial_vacancy_id"
                value={selectedVacancyId || 'none'}
                onValueChange={(value) => onSelectedVacancyChange(value === 'none' ? '' : value)}
                disabled={disabled}
                placeholder={t('candidateForm.selectVacancyOptional')}
                searchPlaceholder={t('interviews.form.searchVacancies')}
                emptyText={t('interviews.form.noVacancies')}
                options={[
                  { value: 'none', label: t('candidateForm.noVacancyAssigned') },
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

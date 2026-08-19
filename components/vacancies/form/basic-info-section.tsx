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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { sectorLabel } from '@/lib/vacancies/sector-i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WORK_MODE_NONE, type VacancyFormValues } from '@/lib/validations/vacancy'
import type { EmploymentType, Sector, VacancyStatus, WorkMode } from '@/lib/types'

const employmentTypes: { value: EmploymentType; key: string }[] = [
  { value: 'full_time', key: 'enum.employment.fullTime' },
  { value: 'part_time', key: 'enum.employment.partTime' },
  { value: 'contract', key: 'enum.employment.contract' },
  { value: 'internship', key: 'enum.employment.internship' },
]

const workModes: { value: WorkMode; key: string }[] = [
  { value: 'remote', key: 'enum.workMode.remote' },
  { value: 'hybrid', key: 'enum.workMode.hybrid' },
  { value: 'onsite', key: 'enum.workMode.onsite' },
]

interface BasicInfoSectionProps {
  form: UseFormReturn<VacancyFormValues>
  sectors: Sector[]
  statusOptions: VacancyStatus[]
  orgMembers: { id: string; full_name: string | null }[]
  disabled: boolean
}

export function BasicInfoSection({ form, sectors, statusOptions, orgMembers, disabled }: BasicInfoSectionProps) {
  const t = useTranslations()
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('vacancy.form.basicInfo')}</CardTitle>
        <CardDescription>{t('vacancy.form.basicInfoDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t('vacancy.form.positionTitle')} *</Label>
          <Input
            id="title"
            placeholder={t('vacancy.form.titlePlaceholder')}
            disabled={disabled}
            {...register('title')}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sector_id">{t('columns.sector')} *</Label>
            <Controller
              control={control}
              name="sector_id"
              render={({ field }) => (
                <SearchableSelect
                  id="sector_id"
                  value={field.value || ''}
                  onValueChange={(value: string) => field.onChange(value)}
                  disabled={disabled}
                  placeholder={t('vacancy.form.selectSector')}
                  searchPlaceholder={t('vacancy.form.searchSectors')}
                  emptyText={t('vacancy.form.noSectors')}
                  options={sectors.map((sector) => ({
                    value: sector.id,
                    label: sectorLabel(t, sector.name),
                    // Keep the English name searchable too, so typing either works.
                    searchText: `${sectorLabel(t, sector.name)} ${sector.name}`,
                  }))}
                />
              )}
            />
            {errors.sector_id && <p className="text-xs text-destructive">{errors.sector_id.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status_id">{t('common.status')} *</Label>
            <Controller
              control={control}
              name="status_id"
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger id="status_id">
                    <SelectValue placeholder={t('vacancy.form.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {t.has(`vacStatus.${status.code}`) ? t(`vacStatus.${status.code}`) : status.name}
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
            <Label htmlFor="department">{t('columns.department')}</Label>
            <Input id="department" placeholder={t('vacancy.form.deptPlaceholder')} disabled={disabled} {...register('department')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">{t('columns.location')}</Label>
            <Input
              id="location"
              placeholder={t('vacancy.form.locationPlaceholder')}
              disabled={disabled}
              {...register('location')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="employment_type">{t('columns.employmentType')}</Label>
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
                        {t(type.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_mode">{t('columns.workMode')}</Label>
            <Controller
              control={control}
              name="work_mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger id="work_mode">
                    <SelectValue placeholder={t('common.notSpecified')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_MODE_NONE}>{t('common.notSpecified')}</SelectItem>
                    {workModes.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openings_count">{t('vacancy.form.openingsCount')}</Label>
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
            <Label htmlFor="hiring_manager_id">{t('columns.hiringManager')}</Label>
            <Controller
              control={control}
              name="hiring_manager_id"
              render={({ field }) => (
                <SearchableSelect
                  id="hiring_manager_id"
                  options={orgMembers.map((m) => ({ value: m.id, label: m.full_name || '—' }))}
                  value={field.value ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v || null)
                    // Keep the display-name column in sync with the picked member.
                    setValue('hiring_manager_name', orgMembers.find((m) => m.id === v)?.full_name ?? '')
                  }}
                  placeholder={t('vacancy.form.hmSelect')}
                  searchPlaceholder={t('vacancy.form.hmSearch')}
                  emptyText={t('vacancy.form.hmEmpty')}
                  disabled={disabled}
                />
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

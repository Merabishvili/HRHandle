'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sectorLabel } from '@/lib/vacancies/sector-i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface BasicsState {
  title: string
  department: string
  sectorId: string | null
  location: string
  /** Work mode — persisted to `vacancies.work_mode`. */
  workMode: 'remote' | 'hybrid' | 'onsite'
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship'
  openingsCount: number
  hiringManagerName: string
}

interface StepBasicsProps {
  value: BasicsState
  onChange: (next: BasicsState) => void
  sectors: { id: string; name: string }[]
}

/**
 * Wave 2.7 wizard — Step 1 / Basics per Create Vacancy Steps.dc.html.
 *
 * Only required field is the position title — everything else is
 * optional. Sector → optional (was required), Work mode → NEW.
 * Status dropdown is gone; status is decided by the footer action.
 */
export function StepBasics({ value, onChange, sectors }: StepBasicsProps) {
  const t = useTranslations()
  const set = <K extends keyof BasicsState>(key: K, v: BasicsState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id="title" label={t('vacancy.form.positionTitle')} required>
        <Input
          id="title"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={t('vacancy.form.titlePlaceholder')}
          maxLength={200}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="department" label={t('columns.department')}>
          <Input
            id="department"
            value={value.department}
            onChange={(e) => set('department', e.target.value)}
            placeholder={t('vacancy.form.deptPlaceholder')}
            maxLength={100}
          />
        </Field>
        <Field id="sector" label={t('columns.sector')}>
          <Select
            value={value.sectorId ?? ''}
            onValueChange={(v) => set('sectorId', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="sector">
              <SelectValue placeholder={t('vacancy.form.selectSector')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('wizard.noSector')}</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {sectorLabel(t, s.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="location" label={t('columns.location')}>
          <Input
            id="location"
            value={value.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder={t('vacancy.form.locationPlaceholder')}
            maxLength={100}
          />
        </Field>
        <Field id="work_mode" label={t('columns.workMode')}>
          <Select
            value={value.workMode}
            onValueChange={(v) => set('workMode', v as BasicsState['workMode'])}
          >
            <SelectTrigger id="work_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onsite">{t('enum.workMode.onsite')}</SelectItem>
              <SelectItem value="hybrid">{t('enum.workMode.hybrid')}</SelectItem>
              <SelectItem value="remote">{t('enum.workMode.remote')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-[1fr_130px_1fr]">
        <Field id="employment_type" label={t('columns.employmentType')}>
          <Select
            value={value.employmentType}
            onValueChange={(v) => set('employmentType', v as BasicsState['employmentType'])}
          >
            <SelectTrigger id="employment_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">{t('enum.employment.fullTime')}</SelectItem>
              <SelectItem value="part_time">{t('enum.employment.partTime')}</SelectItem>
              <SelectItem value="contract">{t('enum.employment.contract')}</SelectItem>
              <SelectItem value="internship">{t('enum.employment.internship')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id="openings" label={t('columns.openings')}>
          <Input
            id="openings"
            type="number"
            inputMode="numeric"
            min={1}
            value={value.openingsCount}
            onChange={(e) => set('openingsCount', Math.max(1, Number(e.target.value || 1)))}
          />
        </Field>
        <Field id="hiring_manager" label={t('columns.hiringManager')}>
          <Input
            id="hiring_manager"
            value={value.hiringManagerName}
            onChange={(e) => set('hiringManagerName', e.target.value)}
            placeholder={t('vacancy.form.hmPlaceholder')}
            maxLength={100}
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  subtitle,
  required,
  children,
}: {
  id: string
  label: string
  subtitle?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
        {subtitle && <span className="ml-1 text-[10.5px] font-semibold">{subtitle}</span>}
      </Label>
      {children}
    </div>
  )
}

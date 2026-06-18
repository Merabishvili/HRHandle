'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  /** Work mode is NEW per design — captured locally only until a
   * `vacancies.work_mode` column ships (tech-debt.md §1). */
  workMode: 'on_site' | 'hybrid' | 'remote'
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
  const set = <K extends keyof BasicsState>(key: K, v: BasicsState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id="title" label="Position title" required>
        <Input
          id="title"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Senior Software Engineer"
          maxLength={200}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="department" label="Department">
          <Input
            id="department"
            value={value.department}
            onChange={(e) => set('department', e.target.value)}
            placeholder="e.g. Engineering"
            maxLength={100}
          />
        </Field>
        <Field
          id="sector"
          label="Sector"
          subtitle={<span className="text-[oklch(0.5_0.19_27)]">· now optional</span>}
        >
          <Select
            value={value.sectorId ?? ''}
            onValueChange={(v) => set('sectorId', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No sector</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="location" label="Location">
          <Input
            id="location"
            value={value.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Tbilisi"
            maxLength={100}
          />
        </Field>
        <Field
          id="work_mode"
          label="Work mode"
          subtitle={<NewTag />}
        >
          <Select
            value={value.workMode}
            onValueChange={(v) => set('workMode', v as BasicsState['workMode'])}
          >
            <SelectTrigger id="work_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_site">On-site</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px_1fr]">
        <Field id="employment_type" label="Employment type">
          <Select
            value={value.employmentType}
            onValueChange={(v) => set('employmentType', v as BasicsState['employmentType'])}
          >
            <SelectTrigger id="employment_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id="openings" label="Openings">
          <Input
            id="openings"
            type="number"
            inputMode="numeric"
            min={1}
            value={value.openingsCount}
            onChange={(e) => set('openingsCount', Math.max(1, Number(e.target.value || 1)))}
          />
        </Field>
        <Field id="hiring_manager" label="Hiring manager">
          <Input
            id="hiring_manager"
            value={value.hiringManagerName}
            onChange={(e) => set('hiringManagerName', e.target.value)}
            placeholder="e.g. Nino Beridze"
            maxLength={100}
          />
        </Field>
      </div>

      <div className="rounded-[10px] border border-[oklch(0.86_0.05_27)] bg-[oklch(0.995_0.01_20)] px-3.5 py-3 text-[12.5px] leading-[1.45] text-[oklch(0.4_0.06_30)]">
        <strong className="text-[oklch(0.5_0.19_27)]">Removed: the &ldquo;Status&rdquo; dropdown.</strong>{' '}
        A new vacancy is a <strong className="text-foreground">Draft</strong> until you publish — the
        footer decides that, so you never hand-pick draft/open/on-hold here.
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

function NewTag() {
  return (
    <span className="rounded bg-[oklch(0.93_0.07_155)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[oklch(0.36_0.14_150)]">
      NEW
    </span>
  )
}

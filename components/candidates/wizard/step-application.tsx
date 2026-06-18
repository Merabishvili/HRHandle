'use client'

import { AlertTriangle } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/lib/types/application'

export interface ApplicationState {
  source: string | null
  vacancyId: string | null
  /** Code of the starting application stage. Default `applied`; the
   * recruiter can pick a later stage if they're adding someone warm
   * (Wave 2.7 Create Candidate Steps.dc.html — NEW). */
  startingStageCode: ApplicationStatus['code']
}

interface StepApplicationProps {
  value: ApplicationState
  onChange: (next: ApplicationState) => void
  /** Open vacancies + the candidate's possible "Initial vacancy". */
  vacancies: { id: string; title: string }[]
  /** Ordered list of non-terminal stages, for the "Starting stage"
   * picker. Hired / Rejected / Withdrawn aren't valid starting stages. */
  stages: { code: ApplicationStatus['code']; name: string }[]
  /** Set when the email entered in Step 1 already belongs to an
   * existing candidate in the same org. Shows the inline warning. */
  duplicate: { candidateId: string; candidateName: string } | null
}

const SOURCES = ['LinkedIn', 'Indeed', 'Referral', 'Company Website', 'Job Board', 'Other'] as const

/**
 * Wave 2.7 candidate wizard — Step 3 / Application & source per
 * Create Candidate Steps.dc.html.
 *
 * Source + Initial vacancy + **Starting stage** (NEW) + **Duplicate
 * detection** (NEW). The starting stage picker only shows non-terminal
 * stages — recruiters can drop a warm candidate at Screening or
 * Interview, but never directly at Hired/Rejected.
 *
 * Duplicate detection runs server-side; the parent wizard supplies the
 * result via the `duplicate` prop. When set, the warning tile renders
 * inline with a link into the existing candidate's profile.
 */
export function StepApplication({
  value,
  onChange,
  vacancies,
  stages,
  duplicate,
}: StepApplicationProps) {
  const set = <K extends keyof ApplicationState>(key: K, v: ApplicationState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">Recruitment details</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Source and which pipeline this candidate enters.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="source" label="Source">
          <Select
            value={value.source ?? '__none__'}
            onValueChange={(v) => set('source', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="source">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not specified</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="vacancy" label="Initial vacancy">
          <Select
            value={value.vacancyId ?? '__none__'}
            onValueChange={(v) => set('vacancyId', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="vacancy">
              <SelectValue placeholder="Choose vacancy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No vacancy yet</SelectItem>
              {vacancies.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {value.vacancyId && (
        <div>
          <Label className="text-[11.5px] font-medium text-muted-foreground">
            Starting stage <NewTag />
          </Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {stages.map((stage) => {
              const isCurrent = value.startingStageCode === stage.code
              return (
                <button
                  key={stage.code}
                  type="button"
                  onClick={() => set('startingStageCode', stage.code)}
                  aria-pressed={isCurrent}
                  className={cn(
                    'rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors',
                    isCurrent
                      ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                      : 'border border-[oklch(0.9_0.01_250)] text-foreground/80 hover:bg-muted',
                  )}
                >
                  {stage.name}
                  {stage.code === 'applied' && (
                    <span className="ml-1 text-[10.5px] font-medium text-muted-foreground">default</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            Sourced someone warm? Drop them straight into a later stage.
          </p>
        </div>
      )}

      {duplicate && (
        <div className="flex gap-2.5 rounded-[10px] border border-[oklch(0.86_0.07_70)] bg-[oklch(0.97_0.03_70)] px-3.5 py-2.5">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.12_60)]"
            aria-hidden
          />
          <p className="flex-1 text-[12px] leading-[1.45] text-[oklch(0.4_0.08_55)]">
            <strong className="font-semibold">Possible duplicate.</strong> This email matches an existing candidate{' '}
            <a
              href={`/candidates/${duplicate.candidateId}`}
              className="font-semibold text-[oklch(0.42_0.12_250)] hover:underline"
            >
              {duplicate.candidateName}
            </a>
            . Review &amp; merge before adding.{' '}
            <NewTag />
          </p>
        </div>
      )}
    </div>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11.5px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function NewTag() {
  return (
    <span className="ml-1 rounded bg-[oklch(0.93_0.07_155)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[oklch(0.36_0.14_150)]">
      NEW
    </span>
  )
}

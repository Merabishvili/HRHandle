'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/lib/types/application'
import { statusLabel } from '@/lib/pipeline/status-i18n'

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
  /** Merged Notes section (Source + Notes are one step now). */
  note: string
  onNoteChange: (next: string) => void
}

// Stored value stays canonical English (kept stable in the DB); the label
// key localizes the display. LinkedIn / Indeed are proper nouns and read
// the same across locales.
const SOURCES = [
  { value: 'LinkedIn', labelKey: null },
  { value: 'Indeed', labelKey: null },
  { value: 'Referral', labelKey: 'candWizard.application.srcReferral' },
  { value: 'Company Website', labelKey: 'candWizard.application.srcCompanyWebsite' },
  { value: 'Job Board', labelKey: 'candWizard.application.srcJobBoard' },
  { value: 'Other', labelKey: 'candWizard.application.srcOther' },
] as const

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
  note,
  onNoteChange,
}: StepApplicationProps) {
  const t = useTranslations()
  const set = <K extends keyof ApplicationState>(key: K, v: ApplicationState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">{t('candWizard.application.recruitmentDetails')}</h2>
        <p className="text-[12.5px] text-muted-foreground">
          {t('candWizard.application.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="source" label={t('candWizard.application.sourceLabel')}>
          <Select
            value={value.source ?? '__none__'}
            onValueChange={(v) => set('source', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="source">
              <SelectValue placeholder={t('candWizard.application.selectSource')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('candWizard.application.notSpecified')}</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.labelKey ? t(s.labelKey) : s.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="vacancy" label={t('candWizard.application.initialVacancy')}>
          <Select
            value={value.vacancyId ?? '__none__'}
            onValueChange={(v) => set('vacancyId', v === '__none__' ? null : v)}
          >
            <SelectTrigger id="vacancy">
              <SelectValue placeholder={t('candWizard.application.chooseVacancy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('candWizard.application.noVacancyYet')}</SelectItem>
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
            {t('candWizard.application.startingStage')}
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
                  {statusLabel(t, stage.code, stage.name)}
                  {stage.code === 'applied' && (
                    <span className="ml-1 text-[10.5px] font-medium text-muted-foreground">{t('candWizard.application.default')}</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {t('candWizard.application.warmHint')}
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
            {t.rich('candWizard.application.duplicate', {
              name: duplicate.candidateName,
              b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
              link: (chunks) => (
                <a
                  href={`/candidates/${duplicate.candidateId}`}
                  className="font-semibold text-[oklch(0.42_0.12_250)] hover:underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      )}

      {/* Notes (merged into this step) */}
      <div className="h-px bg-[oklch(0.93_0.01_250)]" />
      <div>
        <h2 className="text-[15px] font-bold text-foreground">
          {t('candWizard.application.notes')} <span className="text-[12px] font-normal text-muted-foreground">{t('candWizard.application.optionalSuffix')}</span>
        </h2>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={t('candWizard.application.notePlaceholder')}
          rows={4}
          maxLength={2000}
          className="mt-2"
          aria-label={t('candWizard.application.noteAria')}
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground/80">{note.length} / 2000</p>
      </div>
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

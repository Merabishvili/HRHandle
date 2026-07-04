'use client'

import { useState } from 'react'
import { Briefcase, Pencil, ChevronRight, Check, AlertTriangle, Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { BasicsState } from './step-basics'
import type { DatesCompState } from './step-dates-comp'
import type { DescriptionState } from './step-description'
import type { ScorecardState, ScreeningAnswerType } from './step-scorecard'

interface StepReviewProps {
  basics: BasicsState
  datesComp: DatesCompState
  description: DescriptionState
  scorecard: ScorecardState
  sectors: { id: string; name: string }[]
  publishChoice: 'publish' | 'draft'
  onPublishChoiceChange: (choice: 'publish' | 'draft') => void
  onEditStep: (stepId: string) => void
}

const TYPE_LABELS: Record<ScreeningAnswerType, string> = {
  yes_no: 'YES/NO',
  short_text: 'TEXT',
  number: 'NUMBER',
  select: 'SELECT',
}

/**
 * Wave 2.7 wizard — Step 5 / Review & publish (compact) per
 * Create Vacancy Review Compact.dc.html.
 *
 * Built to fit one screen: identity + 4-up stat strip, Basics & Dates as
 * side-by-side key-value lists, the three long text blocks collapsed behind a
 * single Description row (expand to verify), scorecard as chips + a one-line
 * screening summary, and the single Publish/Draft commit choice. Every group
 * carries an Edit link back to its step.
 */
export function StepReview({
  basics,
  datesComp,
  description,
  scorecard,
  sectors,
  publishChoice,
  onPublishChoiceChange,
  onEditStep,
}: StepReviewProps) {
  const [descOpen, setDescOpen] = useState(false)
  const sectorName = sectors.find((s) => s.id === basics.sectorId)?.name ?? null
  const descriptionComplete = description.description.trim().length > 0
  const mustHaveCount = scorecard.attributes.filter((a) => a.mustHave).length

  const metaLine =
    [
      basics.department,
      basics.location,
      formatWorkMode(basics.workMode),
      formatEmployment(basics.employmentType),
      `${basics.openingsCount} opening${basics.openingsCount === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(' · ') || 'No department or location yet'

  return (
    <div className="flex max-w-[1000px] flex-col gap-3.5">
      {/* Identity + 4-up stat strip */}
      <div className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white p-4 sm:p-[18px]">
        <div className="mb-3.5 flex items-center gap-3.5">
          <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] bg-[oklch(0.93_0.05_250)]">
            <Briefcase className="h-[22px] w-[22px] text-[oklch(0.45_0.16_250)]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-foreground">
              {basics.title || 'Untitled role'}
            </h2>
            <p className="truncate text-[12.5px] text-muted-foreground">{metaLine}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatTile label="Salary" value={formatSalary(datesComp)} />
          <StatTile
            label="Scorecard"
            value={
              scorecard.attributes.length === 0
                ? 'Default set'
                : `${scorecard.attributes.length} attr${
                    mustHaveCount > 0 ? ` · ${mustHaveCount} must-have` : ''
                  }`
            }
          />
          <StatTile
            label="Description"
            value={descriptionComplete ? '✓ Complete' : 'Incomplete'}
            tone={descriptionComplete ? 'good' : 'warn'}
          />
          <StatTile
            label="Visibility"
            value={description.showOnPublicPage ? 'Public · on' : 'Public · off'}
          />
        </div>
      </div>

      {/* Basics + Dates side-by-side */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <FactSection title="Basics" onEdit={() => onEditStep('basics')}>
          <FactRow label="Department" value={basics.department || '—'} />
          <FactRow label="Sector" value={sectorName || '—'} />
          <FactRow
            label="Employment"
            value={`${formatEmployment(basics.employmentType)} · ${basics.openingsCount} opening${
              basics.openingsCount === 1 ? '' : 's'
            }`}
          />
          <FactRow label="Hiring manager" value={basics.hiringManagerName || '—'} muted={!basics.hiringManagerName} />
        </FactSection>

        <FactSection title="Dates & compensation" onEdit={() => onEditStep('dates-comp')}>
          <FactRow label="Start date" value={formatDate(datesComp.startDate) ?? 'On creation'} />
          <FactRow label="End date" value={formatDate(datesComp.endDate) ?? '—'} muted={!datesComp.endDate} />
          <FactRow label="Salary" value={formatSalary(datesComp)} />
          <FactRow label="Currency" value={datesComp.salaryCurrency} />
        </FactSection>
      </div>

      {/* Description — collapsed by default */}
      <section className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setDescOpen((v) => !v)}
            aria-expanded={descOpen}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <ChevronRight
              className={cn(
                'h-[15px] w-[15px] shrink-0 text-muted-foreground transition-transform',
                descOpen && 'rotate-90',
              )}
              aria-hidden
            />
            <span className="text-[14px] font-bold text-foreground">Description</span>
            <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">
              About · Responsibilities · Requirements
            </span>
            {descriptionComplete ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[oklch(0.95_0.05_145)] px-2 py-0.5 text-[11px] font-bold text-[oklch(0.4_0.13_150)]">
                <Check className="h-3 w-3" aria-hidden />
                Complete
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[oklch(0.96_0.04_27)] px-2 py-0.5 text-[11px] font-bold text-[oklch(0.5_0.19_27)]">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Incomplete — About required
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onEditStep('description')}
            className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[oklch(0.42_0.16_250)] transition-colors hover:underline"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Edit
          </button>
        </div>
        {descOpen && (
          <div className="flex flex-col gap-3 border-t border-[oklch(0.95_0.005_250)] px-4 py-3.5">
            <PreviewBlock label="About the job" text={description.description} required />
            <PreviewBlock label="Responsibilities" text={description.responsibilities} />
            <PreviewBlock label="Requirements" text={description.requirements} />
          </div>
        )}
      </section>

      {/* Scorecard & questions — chips + one-line screening summary */}
      <FactSection title="Scorecard & questions" onEdit={() => onEditStep('scorecard')}>
        {scorecard.attributes.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            Default scorecard — customise it later on the vacancy.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {scorecard.attributes.map((a, i) => (
              <span
                key={`${a.label}-${i}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[12px] font-medium',
                  a.mustHave
                    ? 'border-[oklch(0.88_0.06_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.5_0.19_27)]'
                    : 'border-[oklch(0.9_0.01_250)] text-foreground/80',
                )}
              >
                {a.mustHave && (
                  <Star className="h-2.5 w-2.5 fill-[oklch(0.5_0.19_27)] text-[oklch(0.5_0.19_27)]" aria-hidden />
                )}
                {a.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[oklch(0.96_0.005_250)] pt-2.5 text-[12.5px]">
          <span className="text-muted-foreground">Screening:</span>
          {scorecard.screeningQuestions.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            scorecard.screeningQuestions.map((q, i) => (
              <span key={`${q.label}-${i}`} className="inline-flex items-center gap-1.5 text-foreground">
                {q.label}
                <span className="rounded bg-[oklch(0.95_0.01_250)] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground">
                  {TYPE_LABELS[q.answerType]}
                </span>
              </span>
            ))
          )}
        </div>
      </FactSection>

      {/* Finish */}
      <div className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white p-4 sm:p-[18px]">
        <p className="mb-3 text-[14px] font-bold text-foreground">How do you want to finish?</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <CommitOption
            selected={publishChoice === 'publish'}
            onSelect={() => onPublishChoiceChange('publish')}
            title="Publish now"
            subtitle="Live + apply link generated"
          />
          <CommitOption
            selected={publishChoice === 'draft'}
            onSelect={() => onPublishChoiceChange('draft')}
            title="Save as draft"
            subtitle="Not visible, no apply link yet"
          />
        </div>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn'
}) {
  return (
    <div className="rounded-[9px] border border-[oklch(0.93_0.01_250)] px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[13px] font-bold',
          tone === 'good'
            ? 'text-[oklch(0.4_0.14_150)]'
            : tone === 'warn'
              ? 'text-[oklch(0.5_0.19_27)]'
              : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FactSection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white">
      <header className="flex items-center px-4 py-3">
        <span className="text-[14px] font-bold text-foreground">{title}</span>
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[oklch(0.42_0.16_250)] transition-colors hover:underline"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Edit
        </button>
      </header>
      <div className="px-4 pb-3">{children}</div>
    </section>
  )
}

function FactRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[oklch(0.96_0.005_250)] py-[7px] text-[13px] first:border-t-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}

function PreviewBlock({ label, text, required }: { label: string; text: string; required?: boolean }) {
  const trimmed = text.trim()
  return (
    <div className="text-[12.5px]">
      <p className="text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </p>
      {trimmed ? (
        <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{trimmed}</p>
      ) : (
        <p className="mt-0.5 italic text-muted-foreground/70">Not added yet</p>
      )}
    </div>
  )
}

function CommitOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors',
        selected
          ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)]'
          : 'border-[oklch(0.9_0.01_250)] hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full',
          selected ? 'bg-[oklch(0.55_0.18_250)]' : 'border-[1.5px] border-[oklch(0.78_0.01_250)]',
        )}
        aria-hidden
      >
        {selected && <span className="text-[10px] font-bold text-white">✓</span>}
      </span>
      <span>
        <span
          className={cn(
            'block text-[13px] font-bold',
            selected ? 'text-[oklch(0.2_0.16_250)]' : 'text-foreground/80',
          )}
        >
          {title}
        </span>
        <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSalary(dc: DatesCompState): string {
  const { salaryMin, salaryMax, salaryCurrency } = dc
  const min = salaryMin !== null ? salaryMin.toLocaleString() : null
  const max = salaryMax !== null ? salaryMax.toLocaleString() : null
  if (min && max) return `${salaryCurrency} ${min}–${max}`
  if (min) return `${salaryCurrency} ${min}+`
  if (max) return `Up to ${salaryCurrency} ${max}`
  return 'Not specified'
}

function formatEmployment(value: BasicsState['employmentType']): string {
  switch (value) {
    case 'full_time': return 'Full-time'
    case 'part_time': return 'Part-time'
    case 'contract': return 'Contract'
    case 'internship': return 'Internship'
  }
}

function formatWorkMode(value: BasicsState['workMode']): string {
  switch (value) {
    case 'onsite': return 'On-site'
    case 'hybrid': return 'Hybrid'
    case 'remote': return 'Remote'
  }
}

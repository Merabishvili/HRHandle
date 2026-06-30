'use client'

import { Briefcase, Pencil, AlertTriangle } from 'lucide-react'

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
  yes_no: 'Yes / No',
  short_text: 'Short text',
  number: 'Number',
  select: 'Select',
}

/**
 * Wave 2.7 wizard — Step 5 / Review & publish.
 *
 * A full grouped recap of everything entered (each group has an Edit link
 * jumping back to its step), publish-blockers surfaced inline, and the single
 * commit choice (Publish now / Save as draft) — the footer's primary button
 * mirrors this radio.
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
  const sectorName = sectors.find((s) => s.id === basics.sectorId)?.name ?? null
  const descriptionComplete = description.description.trim().length > 0
  const mustHaveCount = scorecard.attributes.filter((a) => a.mustHave).length

  return (
    <div className="flex max-w-[900px] flex-col gap-3">
      {/* Identity + top stat strip */}
      <div className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4">
        <header className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)]">
            <Briefcase className="h-5 w-5 text-[oklch(0.45_0.16_250)]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-bold text-foreground">
              {basics.title || 'Untitled role'}
            </h2>
            <p className="truncate text-[12.5px] text-muted-foreground">
              {[basics.department, basics.location, formatWorkMode(basics.workMode)]
                .filter(Boolean)
                .join(' · ') || 'No department or location yet'}
            </p>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <StatTile label="Salary">
            {datesComp.salaryMin !== null || datesComp.salaryMax !== null ? (
              <span className="font-semibold text-foreground">{formatSalary(datesComp)}</span>
            ) : (
              <span className="font-semibold text-muted-foreground">Not specified</span>
            )}
          </StatTile>
          <StatTile label="Scorecard">
            {scorecard.attributes.length === 0 ? (
              <span className="font-semibold text-muted-foreground">Default set</span>
            ) : (
              <span className="font-semibold text-foreground">
                {scorecard.attributes.length}{' '}
                {scorecard.attributes.length === 1 ? 'attribute' : 'attributes'}
                {mustHaveCount > 0 ? ` · ${mustHaveCount} must-have` : ''}
              </span>
            )}
          </StatTile>
          <StatTile label="Description">
            {descriptionComplete ? (
              <span className="font-semibold text-[oklch(0.42_0.14_150)]">Complete</span>
            ) : (
              <span className="font-semibold text-[oklch(0.5_0.19_27)]">Add before publish</span>
            )}
          </StatTile>
        </div>
      </div>

      {/* Publish blocker */}
      {!descriptionComplete && (
        <button
          type="button"
          onClick={() => onEditStep('description')}
          className="flex items-center gap-2 rounded-[10px] border border-[oklch(0.86_0.05_27)] bg-[oklch(0.995_0.01_20)] px-3.5 py-2.5 text-left text-[12.5px] text-[oklch(0.42_0.1_30)] transition-colors hover:bg-[oklch(0.98_0.02_25)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[oklch(0.5_0.19_27)]" aria-hidden />
          <span className="flex-1">
            <strong className="font-semibold text-[oklch(0.5_0.19_27)]">About the job</strong> is
            required to publish.
          </span>
          <span className="font-semibold text-[oklch(0.45_0.16_250)]">Add it →</span>
        </button>
      )}

      {/* Basics */}
      <Section title="Basics" onEdit={() => onEditStep('basics')}>
        <SummaryRow label="Title" value={basics.title || '—'} />
        <SummaryRow label="Department" value={basics.department || '—'} />
        <SummaryRow label="Sector" value={sectorName || '—'} />
        <SummaryRow label="Location" value={basics.location || '—'} />
        <SummaryRow label="Work mode" value={formatWorkMode(basics.workMode)} />
        <SummaryRow label="Employment type" value={formatEmployment(basics.employmentType)} />
        <SummaryRow label="Openings" value={String(basics.openingsCount)} />
        <SummaryRow label="Hiring manager" value={basics.hiringManagerName || '—'} />
      </Section>

      {/* Dates & compensation */}
      <Section title="Dates & compensation" onEdit={() => onEditStep('dates-comp')}>
        <SummaryRow label="Start date" value={datesComp.startDate || 'On creation'} />
        <SummaryRow label="End date" value={datesComp.endDate || '—'} />
        <SummaryRow label="Salary" value={formatSalary(datesComp)} />
        <SummaryRow label="Currency" value={datesComp.salaryCurrency} />
      </Section>

      {/* Description */}
      <Section title="Description" onEdit={() => onEditStep('description')}>
        <PreviewRow label="About the job" text={description.description} required />
        <PreviewRow label="Responsibilities" text={description.responsibilities} />
        <PreviewRow label="Requirements" text={description.requirements} />
      </Section>

      {/* Scorecard & questions */}
      <Section title="Scorecard & questions" onEdit={() => onEditStep('scorecard')}>
        {scorecard.attributes.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            Default scorecard — you can customise it later on the vacancy.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {scorecard.attributes.map((a, i) => (
              <span
                key={`${a.label}-${i}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium',
                  a.mustHave
                    ? 'bg-[oklch(0.96_0.05_27)] text-[oklch(0.5_0.19_27)]'
                    : 'border border-[oklch(0.9_0.01_250)] text-foreground/80',
                )}
              >
                {a.label}
                <span className="text-[10px] uppercase opacity-70">
                  {a.mustHave ? 'must' : 'nice'}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2">
          <p className="mb-1 text-[11.5px] font-medium text-muted-foreground">Screening questions</p>
          {scorecard.screeningQuestions.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">None</p>
          ) : (
            <ul className="space-y-1">
              {scorecard.screeningQuestions.map((q, i) => (
                <li key={`${q.label}-${i}`} className="flex items-center gap-2 text-[12.5px]">
                  <span className="flex-1 truncate text-foreground">{q.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {TYPE_LABELS[q.answerType]}
                  </span>
                  {q.knockout && (
                    <span className="rounded bg-[oklch(0.96_0.05_27)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[oklch(0.5_0.19_27)]">
                      Knockout
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* Public visibility */}
      <Section title="Public visibility" onEdit={() => onEditStep('description')}>
        <SummaryRow
          label="Public jobs page"
          value={description.showOnPublicPage ? 'On (when published)' : 'Off'}
        />
      </Section>

      {/* Commit choice — mirrors the footer primary button */}
      <div className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4">
        <p className="mb-2.5 text-[13px] font-bold text-foreground">How do you want to finish?</p>
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
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          You can flip either later from the vacancy&apos;s Settings tab.
        </p>
      </div>
    </div>
  )
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[13.5px] font-bold text-foreground">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[oklch(0.45_0.16_250)] transition-colors hover:underline"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          Edit
        </button>
      </header>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[12.5px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function PreviewRow({
  label,
  text,
  required,
}: {
  label: string
  text: string
  required?: boolean
}) {
  const trimmed = text.trim()
  const preview = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed
  return (
    <div className="text-[12.5px]">
      <p className="text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </p>
      {preview ? (
        <p className="mt-0.5 whitespace-pre-wrap text-foreground/90">{preview}</p>
      ) : (
        <p className="mt-0.5 italic text-muted-foreground/70">Not added yet</p>
      )}
    </div>
  )
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[9px] border border-[oklch(0.93_0.01_250)] px-3 py-2.5 text-[12.5px]">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1">{children}</p>
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
          selected ? 'bg-[oklch(0.55_0.18_250)]' : 'border border-[oklch(0.85_0.01_250)]',
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
    case 'on_site': return 'On-site'
    case 'hybrid': return 'Hybrid'
    case 'remote': return 'Remote'
  }
}

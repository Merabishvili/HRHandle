'use client'

import { useState } from 'react'
import { Pencil, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { toDisplayFullName } from '@/lib/format-name'
import type { PersonalState } from './step-personal'
import type { ApplicationState } from './step-application'
import type { BackgroundState } from './step-experience-education'

type EditStep = 'personal' | 'background' | 'application'

interface StepReviewProps {
  personal: PersonalState
  application: ApplicationState
  background: BackgroundState
  note: string
  vacancies: { id: string; title: string }[]
  stages: { code: ApplicationState['startingStageCode']; name: string }[]
  onEditStep: (step: EditStep) => void
}

/**
 * Wave 2.7 candidate wizard — Step 5 / Review (compact) per
 * Create Candidate Restructured.dc.html.
 *
 * Identity + two-column Contact/Application facts, with Experience &
 * Education as collapsible sections (one open at a time; the other a "N roles"
 * summary). Every group has an Edit jump-back; the commit buttons live only in
 * the wizard footer.
 */
export function StepReview({
  personal,
  application,
  background,
  note,
  vacancies,
  stages,
  onEditStep,
}: StepReviewProps) {
  // One collapsible open at a time — default to the first non-empty section.
  const [open, setOpen] = useState<'experience' | 'education' | null>(
    background.experience.length > 0
      ? 'experience'
      : background.education.length > 0
        ? 'education'
        : null,
  )

  const fullName = toDisplayFullName(personal.firstName, personal.lastName) || 'New candidate'
  const initials =
    `${personal.firstName[0] ?? ''}${personal.lastName[0] ?? ''}`.toUpperCase() || '?'
  const languages = personal.languages
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const identityMeta = [personal.location, personal.timezone, ...languages]
    .filter(Boolean)
    .join(' · ')

  const vacancyTitle = application.vacancyId
    ? (vacancies.find((v) => v.id === application.vacancyId)?.title ?? '—')
    : 'No vacancy yet'
  const stageName =
    stages.find((s) => s.code === application.startingStageCode)?.name ??
    application.startingStageCode
  const noteCount = note.trim() ? 1 : 0

  return (
    <div className="flex max-w-[1000px] flex-col gap-3.5">
      {/* Identity */}
      <div className="flex items-center gap-3.5 rounded-xl border border-[oklch(0.91_0.012_250)] bg-white p-4 sm:p-[18px]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.04_250)] text-[15px] font-bold text-[oklch(0.45_0.16_250)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-foreground">{fullName}</p>
          {identityMeta && (
            <p className="truncate text-[12.5px] text-muted-foreground">{identityMeta}</p>
          )}
        </div>
        <EditLink onClick={() => onEditStep('personal')} />
      </div>

      {/* Contact + Application */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <FactCard title="Contact & details" onEdit={() => onEditStep('personal')}>
          <FactRow label="Email" value={personal.email || '—'} />
          <FactRow label="Phone" value={personal.phone || '—'} />
          <FactRow label="Salary exp." value={personal.salaryExpectation || '—'} />
          <FactRow label="Notice" value={personal.noticePeriod || '—'} />
        </FactCard>

        <FactCard title="Application" onEdit={() => onEditStep('application')}>
          <FactRow label="Source" value={application.source || 'Not specified'} />
          <FactRow label="Vacancy" value={vacancyTitle} />
          <FactRow label="Starting stage">
            <span className="rounded-md bg-[oklch(0.93_0.05_250)] px-2 py-0.5 text-[11px] font-bold text-[oklch(0.42_0.16_250)]">
              {stageName}
            </span>
          </FactRow>
          <FactRow
            label="Note"
            value={noteCount > 0 ? `${noteCount} note added` : 'None'}
            muted={noteCount === 0}
          />
        </FactCard>
      </div>

      {/* Experience (collapsible) */}
      <CollapsibleSection
        title="Experience"
        summary={`${background.experience.length} ${background.experience.length === 1 ? 'role' : 'roles'}`}
        isOpen={open === 'experience'}
        onToggle={() => setOpen((o) => (o === 'experience' ? null : 'experience'))}
        onEdit={() => onEditStep('background')}
      >
        {background.experience.length === 0 ? (
          <p className="text-[12.5px] italic text-muted-foreground/70">None added</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {background.experience.map((e, i) => (
              <li key={i} className="border-t border-[oklch(0.95_0.005_250)] pt-2 first:border-t-0 first:pt-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {e.title || 'Untitled role'}
                  {e.company && <span className="text-foreground/70"> · {e.company}</span>}
                </p>
                {(e.start_date || e.end_date || e.is_current) && (
                  <p className="text-[11.5px] text-muted-foreground">
                    {e.start_date || '?'} — {e.is_current ? 'Present' : e.end_date || '?'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* Education (collapsible) */}
      <CollapsibleSection
        title="Education"
        summary={`${background.education.length} ${background.education.length === 1 ? 'entry' : 'entries'}`}
        isOpen={open === 'education'}
        onToggle={() => setOpen((o) => (o === 'education' ? null : 'education'))}
        onEdit={() => onEditStep('background')}
      >
        {background.education.length === 0 ? (
          <p className="text-[12.5px] italic text-muted-foreground/70">None added</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {background.education.map((e, i) => (
              <li key={i} className="border-t border-[oklch(0.95_0.005_250)] pt-2 first:border-t-0 first:pt-0">
                <p className="text-[13px] font-semibold text-foreground">
                  {e.institution || 'Untitled institution'}
                </p>
                {(e.degree || e.field_of_study) && (
                  <p className="text-[11.5px] text-muted-foreground">
                    {[e.degree, e.field_of_study].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </div>
  )
}

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[oklch(0.42_0.16_250)] transition-colors hover:underline"
    >
      <Pencil className="h-3 w-3" aria-hidden />
      Edit
    </button>
  )
}

function FactCard({
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
        <span className="ml-auto">
          <EditLink onClick={onEdit} />
        </span>
      </header>
      <div className="px-4 pb-3">{children}</div>
    </section>
  )
}

function FactRow({
  label,
  value,
  muted,
  children,
}: {
  label: string
  value?: string
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[oklch(0.96_0.005_250)] py-[7px] text-[13px] first:border-t-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {children ?? (
        <span className={cn('truncate text-right font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}>
          {value}
        </span>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  summary,
  isOpen,
  onToggle,
  onEdit,
  children,
}: {
  title: string
  summary: string
  isOpen: boolean
  onToggle: () => void
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronRight
            className={cn('h-[15px] w-[15px] shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
            aria-hidden
          />
          <span className="text-[14px] font-bold text-foreground">{title}</span>
          <span className="text-[12px] text-muted-foreground">{summary}</span>
        </button>
        <EditLink onClick={onEdit} />
      </div>
      {isOpen && <div className="border-t border-[oklch(0.95_0.005_250)] px-4 py-3">{children}</div>}
    </section>
  )
}

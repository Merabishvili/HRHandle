'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Briefcase, Pencil, ChevronRight, Check, AlertTriangle, Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { sectorLabel } from '@/lib/vacancies/sector-i18n'
import type { BasicsState } from './step-basics'
import type { DatesCompState } from './step-dates-comp'
import type { DescriptionState } from './step-description'
import type { ScorecardState } from './step-scorecard'
import { TYPE_LABEL_KEY } from './scorecard-shared'

/** next-intl `t` — passed to module-level formatters that need translation. */
type T = (key: string, values?: Record<string, string | number>) => string

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
  const t = useTranslations()
  const [descOpen, setDescOpen] = useState(false)
  const sectorName = sectorLabel(t, sectors.find((s) => s.id === basics.sectorId)?.name) || null
  const descriptionComplete = description.description.trim().length > 0
  const mustHaveCount = scorecard.attributes.filter((a) => a.mustHave).length

  const metaLine =
    [
      basics.department,
      basics.location,
      t(workModeKey(basics.workMode)),
      t(employmentKey(basics.employmentType)),
      t('wizard.openings', { count: basics.openingsCount }),
    ]
      .filter(Boolean)
      .join(' · ') || t('wizard.noDeptLocation')

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
              {basics.title || t('wizard.untitledRole')}
            </h2>
            <p className="truncate text-[12.5px] text-muted-foreground">{metaLine}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatTile label={t('wizard.salary')} value={formatSalary(datesComp, t)} />
          <StatTile
            label={t('wizard.scorecard')}
            value={
              scorecard.attributes.length === 0
                ? t('wizard.defaultSet')
                : `${t('wizard.attrN', { count: scorecard.attributes.length })}${
                    mustHaveCount > 0 ? ` · ${t('wizard.mustHaveN', { count: mustHaveCount })}` : ''
                  }`
            }
          />
          <StatTile
            label={t('wizard.description')}
            value={descriptionComplete ? `✓ ${t('wizard.complete')}` : t('wizard.incomplete')}
            tone={descriptionComplete ? 'good' : 'warn'}
          />
          <StatTile
            label={t('wizard.visibility')}
            value={description.showOnPublicPage ? t('wizard.publicOn') : t('wizard.publicOff')}
          />
        </div>
      </div>

      {/* Basics + Dates side-by-side */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <FactSection title={t('wizard.stepBasics')} onEdit={() => onEditStep('basics')}>
          <FactRow label={t('columns.department')} value={basics.department || '—'} />
          <FactRow label={t('columns.sector')} value={sectorName || '—'} />
          <FactRow
            label={t('wizard.employment')}
            value={`${t(employmentKey(basics.employmentType))} · ${t('wizard.openings', {
              count: basics.openingsCount,
            })}`}
          />
          <FactRow label={t('columns.hiringManager')} value={basics.hiringManagerName || '—'} muted={!basics.hiringManagerName} />
        </FactSection>

        <FactSection title={t('wizard.stepDates')} onEdit={() => onEditStep('dates-comp')}>
          <FactRow label={t('columns.startDate')} value={formatDate(datesComp.startDate) ?? t('wizard.onCreation')} />
          <FactRow label={t('columns.endDate')} value={formatDate(datesComp.endDate) ?? '—'} muted={!datesComp.endDate} />
          <FactRow label={t('wizard.salary')} value={formatSalary(datesComp, t)} />
          <FactRow label={t('vacancy.form.currency')} value={datesComp.salaryCurrency} />
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
            <span className="text-[14px] font-bold text-foreground">{t('wizard.description')}</span>
            <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">
              {t('wizard.aboutRespReq')}
            </span>
            {descriptionComplete ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[oklch(0.95_0.05_145)] px-2 py-0.5 text-[11px] font-bold text-[oklch(0.4_0.13_150)]">
                <Check className="h-3 w-3" aria-hidden />
                {t('wizard.complete')}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[oklch(0.96_0.04_27)] px-2 py-0.5 text-[11px] font-bold text-[oklch(0.5_0.19_27)]">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {t('wizard.incompleteAboutRequired')}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onEditStep('description')}
            className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[oklch(0.42_0.16_250)] transition-colors hover:underline"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {t('common.edit')}
          </button>
        </div>
        {descOpen && (
          <div className="flex flex-col gap-3 border-t border-[oklch(0.95_0.005_250)] px-4 py-3.5">
            <PreviewBlock label={t('vacancy.form.aboutJob')} text={description.description} required />
            <PreviewBlock label={t('vacancy.form.responsibilities')} text={description.responsibilities} />
            <PreviewBlock label={t('vacancy.form.requirements')} text={description.requirements} />
          </div>
        )}
      </section>

      {/* Scorecard & questions — chips + one-line screening summary */}
      <FactSection title={t('wizard.stepScorecard')} onEdit={() => onEditStep('scorecard')}>
        {scorecard.attributes.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            {t('wizard.defaultScorecardHint')}
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
          <span className="text-muted-foreground">{t('wizard.screening')}</span>
          {scorecard.screeningQuestions.length === 0 ? (
            <span className="text-muted-foreground">{t('wizard.none')}</span>
          ) : (
            scorecard.screeningQuestions.map((q, i) => (
              <span key={`${q.label}-${i}`} className="inline-flex items-center gap-1.5 text-foreground">
                {q.label}
                <span className="rounded bg-[oklch(0.95_0.01_250)] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground">
                  {t(TYPE_LABEL_KEY[q.answerType])}
                </span>
              </span>
            ))
          )}
        </div>
      </FactSection>

      {/* Finish */}
      <div className="rounded-xl border border-[oklch(0.91_0.012_250)] bg-white p-4 sm:p-[18px]">
        <p className="mb-3 text-[14px] font-bold text-foreground">{t('wizard.howFinish')}</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <CommitOption
            selected={publishChoice === 'publish'}
            onSelect={() => onPublishChoiceChange('publish')}
            title={t('wizard.publishNow')}
            subtitle={t('wizard.publishSubtitle')}
          />
          <CommitOption
            selected={publishChoice === 'draft'}
            onSelect={() => onPublishChoiceChange('draft')}
            title={t('wizard.saveAsDraft')}
            subtitle={t('wizard.draftSubtitle')}
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
  const t = useTranslations()
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
          {t('common.edit')}
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
  const t = useTranslations()
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
        <p className="mt-0.5 italic text-muted-foreground/70">{t('wizard.notAddedYet')}</p>
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

function formatSalary(dc: DatesCompState, t: T): string {
  const { salaryMin, salaryMax, salaryCurrency } = dc
  const min = salaryMin !== null ? salaryMin.toLocaleString() : null
  const max = salaryMax !== null ? salaryMax.toLocaleString() : null
  if (min && max) return `${salaryCurrency} ${min}–${max}`
  if (min) return `${salaryCurrency} ${min}+`
  if (max) return t('wizard.upTo', { amount: `${salaryCurrency} ${max}` })
  return t('common.notSpecified')
}

function employmentKey(value: BasicsState['employmentType']): string {
  switch (value) {
    case 'full_time': return 'enum.employment.fullTime'
    case 'part_time': return 'enum.employment.partTime'
    case 'contract': return 'enum.employment.contract'
    case 'internship': return 'enum.employment.internship'
  }
}

function workModeKey(value: BasicsState['workMode']): string {
  switch (value) {
    case 'onsite': return 'enum.workMode.onsite'
    case 'hybrid': return 'enum.workMode.hybrid'
    case 'remote': return 'enum.workMode.remote'
  }
}

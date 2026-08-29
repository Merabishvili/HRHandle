'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronRight, ClipboardCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { dateFnsLocale } from '@/lib/i18n/date-locale'
import type { AssessmentRecord, ScorecardRecommendation } from '@/lib/actions/evaluations'

const REC_LABEL_KEY: Record<ScorecardRecommendation, string> = {
  strong_yes: 'scoreModal.recStrongYes',
  yes: 'scoreModal.recYes',
  lean_no: 'scoreModal.recLeanNo',
  no: 'scoreModal.recNo',
}

const REC_STYLE: Record<ScorecardRecommendation, string> = {
  strong_yes: 'bg-[oklch(0.93_0.08_155)] text-[oklch(0.34_0.14_150)]',
  yes: 'bg-[oklch(0.95_0.05_155)] text-[oklch(0.38_0.12_150)]',
  lean_no: 'bg-[oklch(0.97_0.05_70)] text-[oklch(0.45_0.12_55)]',
  no: 'bg-[oklch(0.96_0.04_27)] text-[oklch(0.5_0.19_27)]',
}

/** 1–5 average across the record's scored criteria, for the score tile. */
function avgOfFive(record: AssessmentRecord): string | null {
  if (record.scores.length === 0) return null
  const sum = record.scores.reduce((a, s) => a + s.score, 0)
  return (sum / record.scores.length).toFixed(1)
}

function barColor(percentage: number): string {
  if (percentage >= 90) return 'bg-[oklch(0.6_0.15_145)]'
  if (percentage >= 50) return 'bg-[oklch(0.55_0.18_250)]'
  return 'bg-[oklch(0.75_0.15_70)]'
}

/**
 * Part B — permanent read-only assessment record on the candidate profile.
 * Renders every SUBMITTED assessment across the candidate's applications
 * (active AND closed), one expandable card per assessor. Always rendered when
 * records exist, independent of the current pipeline stage, so an assessment
 * stays visible after the candidate is hired / rejected / re-applied.
 */
export function AssessmentRecord({ records }: { records: AssessmentRecord[] }) {
  const t = useTranslations()
  if (records.length === 0) return null
  return (
    <section
      id="assessment-record"
      aria-label={t('assess.recordTitle')}
      className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
    >
      <div className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-[15px] font-bold text-foreground">{t('assess.recordTitle')}</h2>
        <span className="text-[12px] text-muted-foreground">{records.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {records.map((r) => (
          <RecordCard key={r.evaluationId} record={r} />
        ))}
      </div>
    </section>
  )
}

function RecordCard({ record }: { record: AssessmentRecord }) {
  const t = useTranslations()
  const dfLocale = dateFnsLocale(useLocale())
  const [open, setOpen] = useState(false)
  const avg = avgOfFive(record)
  const submitted = format(new Date(record.submittedAt), 'dd/MM/yyyy', { locale: dfLocale })

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-white">
          <span className="text-[14px] font-bold leading-none text-foreground">{avg ?? '—'}</span>
          <span className="text-[9px] text-muted-foreground">/ 5</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-foreground">{record.vacancyTitle}</span>
            {record.recommendation && (
              <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-semibold', REC_STYLE[record.recommendation])}>
                {t(REC_LABEL_KEY[record.recommendation])}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
            {record.assessorName} · {submitted} · {t('assess.criteriaCountLabel', { count: record.totalCriteria })}
          </span>
        </span>
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-3.5 py-3.5">
          {record.scores.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {t('assess.criteriaHeading')}
              </p>
              <div className="flex flex-col gap-2">
                {record.scores.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-[45%] shrink-0 truncate text-[12.5px] text-foreground">{s.label}</span>
                    <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full', barColor(s.percentage))} style={{ width: `${s.percentage}%` }} />
                    </span>
                    <span className="w-5 shrink-0 text-right text-[12.5px] font-bold text-foreground">{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.answers.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {t('assess.answersHeading')}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-muted-foreground">
                  {record.answers.length}/{record.totalQuestions}
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {record.answers.map((a, i) => (
                  <div key={i} className="rounded-md border border-border px-3 py-2">
                    <p className="text-[12.5px] font-semibold leading-[1.45] text-foreground">{a.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-[1.55] text-muted-foreground">{a.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.recommendation && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {t('assess.recommendation')}
              </p>
              <span className={cn('inline-block rounded px-2 py-0.5 text-[13px] font-bold', REC_STYLE[record.recommendation])}>
                {t(REC_LABEL_KEY[record.recommendation])}
              </span>
              {record.recommendationReason && (
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-foreground">{record.recommendationReason}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

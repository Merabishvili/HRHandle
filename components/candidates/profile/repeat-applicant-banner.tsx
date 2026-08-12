'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { statusLabel } from '@/lib/pipeline/status-i18n'

export interface RepeatApplicantSummary {
  totalClosed: number
  rejectedCount: number
  withdrawnCount: number
  mostRecent: {
    vacancyTitle: string
    outcome: 'rejected' | 'withdrawn'
    /** Date string from the DB. Caller does the relative-time formatting. */
    closedAtRelative: string
    /** Rejection reason name (null when none chosen or outcome is withdrawn). */
    reasonName: string | null
  } | null
}

interface RepeatApplicantBannerProps {
  summary: RepeatApplicantSummary
  /** Caller decides whether the "View history" link expands the panel or
   * scrolls to it. Either way the trigger lives here so the visual
   * matches the design. */
  onToggleHistory: () => void
  historyOpen: boolean
}

/**
 * Wave 2.3 repeat-applicant banner per Candidate Profile A Refined.dc.html.
 *
 * Amber tile rendered above the active-application selector when the
 * candidate has at least one prior closed application. Inlines the count
 * + most-recent-rejection blurb so the recruiter sees the pattern without
 * having to expand history.
 *
 * Hidden when `totalClosed === 0` (caller can skip rendering, but the
 * component guards anyway).
 */
export function RepeatApplicantBanner({
  summary,
  onToggleHistory,
  historyOpen,
}: RepeatApplicantBannerProps) {
  const t = useTranslations()
  if (summary.totalClosed === 0) return null

  const mostRecent = summary.mostRecent

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[oklch(0.86_0.07_70)] bg-[oklch(0.97_0.03_70)] px-3.5 py-2.5">
      <RotateCcw className="h-4 w-4 shrink-0 text-[oklch(0.5_0.12_60)]" aria-hidden />
      <p className="flex-1 text-[13px] text-[oklch(0.4_0.08_55)]">
        <span className="font-semibold">{t('repeatBanner.label')}</span>{' '}
        {t('repeatBanner.appliedTo', {
          count: summary.totalClosed,
          rejected: summary.rejectedCount,
          withdrawn: summary.withdrawnCount,
        })}
        {mostRecent &&
          t.rich('repeatBanner.mostRecent', {
            title: mostRecent.vacancyTitle,
            outcome: statusLabel(t, mostRecent.outcome, mostRecent.outcome),
            relative: mostRecent.closedAtRelative,
            reason: mostRecent.reasonName
              ? t('repeatBanner.reasonSuffix', { reason: mostRecent.reasonName })
              : '',
            b: (c) => <span className="font-semibold">{c}</span>,
          })}
      </p>
      <button
        type="button"
        onClick={onToggleHistory}
        aria-expanded={historyOpen}
        aria-controls="application-history-panel"
        className="ml-auto whitespace-nowrap text-[12.5px] font-semibold text-[oklch(0.45_0.1_55)] transition-colors hover:text-[oklch(0.35_0.12_55)]"
      >
        {historyOpen ? t('repeatBanner.hideHistory') : t('repeatBanner.viewHistory')}
      </button>
    </div>
  )
}

import { RotateCcw } from 'lucide-react'

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
  if (summary.totalClosed === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[oklch(0.86_0.07_70)] bg-[oklch(0.97_0.03_70)] px-3.5 py-2.5">
      <RotateCcw className="h-4 w-4 shrink-0 text-[oklch(0.5_0.12_60)]" aria-hidden />
      <p className="flex-1 text-[13px] text-[oklch(0.4_0.08_55)]">
        <span className="font-semibold">Repeat candidate.</span>{' '}
        Applied to {summary.totalClosed} previous{' '}
        {summary.totalClosed === 1 ? 'vacancy' : 'vacancies'} here —{' '}
        {summary.rejectedCount} rejected, {summary.withdrawnCount} withdrawn.
        {summary.mostRecent && (
          <>
            {' '}Most recent: <span className="font-semibold">{summary.mostRecent.vacancyTitle}</span>
            , {summary.mostRecent.outcome} {summary.mostRecent.closedAtRelative}
            {summary.mostRecent.reasonName ? ` (reason: ${summary.mostRecent.reasonName})` : ''}.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onToggleHistory}
        aria-expanded={historyOpen}
        aria-controls="application-history-panel"
        className="ml-auto whitespace-nowrap text-[12.5px] font-semibold text-[oklch(0.45_0.1_55)] transition-colors hover:text-[oklch(0.35_0.12_55)]"
      >
        {historyOpen ? 'Hide history ▴' : 'View history ▾'}
      </button>
    </div>
  )
}

import { formatDistanceToNow } from 'date-fns'

import { cn } from '@/lib/utils'

export interface HistoryRow {
  applicationId: string
  vacancyTitle: string
  outcome: 'rejected' | 'withdrawn' | 'hired'
  reasonName: string | null
  closedAt: string
  /** Furthest stage the application reached before closing (e.g.
   * "Interview", "Screening"). Used to surface "got an interview but
   * fell out" patterns. */
  reachedStageName: string | null
}

interface ApplicationHistoryProps {
  rows: HistoryRow[]
  open: boolean
}

/**
 * Wave 2.3 application history panel per Candidate Profile A Refined.dc.html.
 *
 * Collapsible card listing every closed application for the candidate.
 * Caller controls `open` (toggled from the repeat-applicant banner).
 * Renders inside the main outer card on the candidate profile, above the
 * active-application selector when open.
 */
export function ApplicationHistory({ rows, open }: ApplicationHistoryProps) {
  if (!open) return null
  if (rows.length === 0) return null

  const rejectedCount = rows.filter((r) => r.outcome === 'rejected').length
  const withdrawnCount = rows.filter((r) => r.outcome === 'withdrawn').length
  const hiredCount = rows.filter((r) => r.outcome === 'hired').length

  return (
    <section
      id="application-history-panel"
      aria-label="Application history"
      className="overflow-hidden rounded-xl border border-[oklch(0.88_0.01_250)] bg-white shadow-[0_1px_3px_0_oklch(0_0_0_/_0.06)]"
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-[oklch(0.92_0.01_250)] bg-[oklch(0.97_0.005_250)] px-4 py-3">
        <h3 className="text-[13px] font-bold text-foreground">Application history</h3>
        <p className="text-[12px] text-muted-foreground">
          {rows.length} closed
          {rejectedCount > 0 && ` · ${rejectedCount} rejected`}
          {withdrawnCount > 0 && ` · ${withdrawnCount} withdrawn`}
          {hiredCount > 0 && ` · ${hiredCount} hired`}
        </p>
      </header>

      <ul className="divide-y divide-[oklch(0.95_0.005_250)]">
        {rows.map((row) => (
          <li
            key={row.applicationId}
            className="flex flex-wrap items-center gap-3 px-4 py-3 text-[12.5px]"
          >
            <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
              {row.vacancyTitle}
            </span>
            <OutcomeBadge outcome={row.outcome} />
            <span className="text-muted-foreground">
              {row.reasonName ? `Reason: ${row.reasonName}` : row.outcome === 'withdrawn' ? 'Candidate withdrew' : '—'}
            </span>
            <span className="ml-auto whitespace-nowrap text-muted-foreground">
              {formatDistanceToNow(new Date(row.closedAt), { addSuffix: true })}
              {row.reachedStageName && ` · reached ${row.reachedStageName}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OutcomeBadge({ outcome }: { outcome: HistoryRow['outcome'] }) {
  const style = (() => {
    switch (outcome) {
      case 'rejected':
        return {
          bg: 'oklch(0.96 0.05 27)',
          text: 'oklch(0.5 0.19 27)',
          label: 'Rejected',
        }
      case 'withdrawn':
        return {
          bg: 'oklch(0.95 0.01 250)',
          text: 'oklch(0.45 0.02 250)',
          label: 'Withdrawn',
        }
      case 'hired':
        return {
          bg: 'oklch(0.93 0.07 155)',
          text: 'oklch(0.4 0.13 150)',
          label: 'Hired',
        }
    }
  })()
  return (
    <span
      className={cn('rounded px-2 py-0.5 text-[11px] font-semibold')}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

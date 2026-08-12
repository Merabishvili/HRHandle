'use client'

import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { statusLabel } from '@/lib/pipeline/status-i18n'

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
  const t = useTranslations()
  if (!open) return null
  if (rows.length === 0) return null

  const rejectedCount = rows.filter((r) => r.outcome === 'rejected').length
  const withdrawnCount = rows.filter((r) => r.outcome === 'withdrawn').length
  const hiredCount = rows.filter((r) => r.outcome === 'hired').length

  return (
    <section
      id="application-history-panel"
      aria-label={t('appHistory.aria')}
      className="overflow-hidden rounded-xl border border-[oklch(0.88_0.01_250)] bg-white shadow-[0_1px_3px_0_oklch(0_0_0_/_0.06)]"
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-[oklch(0.92_0.01_250)] bg-[oklch(0.97_0.005_250)] px-4 py-3">
        <h3 className="text-[13px] font-bold text-foreground">{t('appHistory.title')}</h3>
        <p className="text-[12px] text-muted-foreground">
          {t('appHistory.closedCount', { count: rows.length })}
          {rejectedCount > 0 && t('appHistory.rejectedSuffix', { count: rejectedCount })}
          {withdrawnCount > 0 && t('appHistory.withdrawnSuffix', { count: withdrawnCount })}
          {hiredCount > 0 && t('appHistory.hiredSuffix', { count: hiredCount })}
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
            <OutcomeBadge label={statusLabel(t, row.outcome, row.outcome)} outcome={row.outcome} />
            <span className="text-muted-foreground">
              {row.reasonName
                ? t('listView.reason', { reason: row.reasonName })
                : row.outcome === 'withdrawn'
                  ? t('appHistory.candidateWithdrew')
                  : '—'}
            </span>
            <span className="ml-auto whitespace-nowrap text-muted-foreground">
              {formatDistanceToNow(new Date(row.closedAt), { addSuffix: true })}
              {row.reachedStageName && t('appHistory.reachedSuffix', { stage: row.reachedStageName })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OutcomeBadge({ label, outcome }: { label: string; outcome: HistoryRow['outcome'] }) {
  const style = (() => {
    switch (outcome) {
      case 'rejected':
        return { bg: 'oklch(0.96 0.05 27)', text: 'oklch(0.5 0.19 27)' }
      case 'withdrawn':
        return { bg: 'oklch(0.95 0.01 250)', text: 'oklch(0.45 0.02 250)' }
      case 'hired':
        return { bg: 'oklch(0.93 0.07 155)', text: 'oklch(0.4 0.13 150)' }
    }
  })()
  return (
    <span
      className={cn('rounded px-2 py-0.5 text-[11px] font-semibold')}
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

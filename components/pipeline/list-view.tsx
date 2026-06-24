'use client'

import Link from 'next/link'

import { Checkbox } from '@/components/ui/checkbox'
import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle, STALE_TEXT } from '@/lib/pipeline/stage-style'
import { timeInStage } from '@/lib/pipeline/time-in-stage'
import { cn } from '@/lib/utils'
import type { CrossVacancyCardData } from './cross-vacancy-card'

interface ListViewProps {
  cards: CrossVacancyCardData[]
  statuses: ApplicationStatus[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
  onToggleAll: (allSelected: boolean) => void
}

/**
 * Wave 2.1 — flat List view alternative to the Board.
 *
 * Same data set, no DnD, no Review-mode entry. Optimized for triage when
 * the recruiter wants to scan candidates across stages without re-acquiring
 * column context — name, role, stage, time-in-stage, fit, all in one row.
 *
 * The Board/List toggle lives in the parent board chrome; this component
 * just renders the rows. Sort order matches the comfortable-board reading
 * order (active stages by stage sort_order, then by time-in-stage desc).
 */
export function ListView({
  cards,
  statuses,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: ListViewProps) {
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const sortOrder = new Map(statuses.map((s) => [s.id, s.sort_order]))

  const sorted = [...cards].sort((a, b) => {
    const aIdx = sortOrder.get(a.stageCode) ?? Number.POSITIVE_INFINITY
    const bIdx = sortOrder.get(b.stageCode) ?? Number.POSITIVE_INFINITY
    if (aIdx !== bIdx) return aIdx - bIdx
    return new Date(a.inStageSince).getTime() - new Date(b.inStageSince).getTime()
  })

  const allSelected = sorted.length > 0 && sorted.every((c) => selectedIds.has(c.applicationId))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(v === true)}
                aria-label="Select all candidates"
              />
            </th>
            <th className="px-3 py-2.5">Candidate</th>
            <th className="px-3 py-2.5">Vacancy</th>
            <th className="px-3 py-2.5">Stage</th>
            <th className="px-3 py-2.5">In stage</th>
            <th className="px-3 py-2.5">Fit</th>
            <th className="px-3 py-2.5">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((card) => {
            const status = statusById.get(card.stageCode)
            const style = getStageStyle(card.stageCode)
            const time = timeInStage(card.inStageSince)
            const fitLabel = card.fitScore === null ? '—' : card.fitScore.toFixed(1)
            const selected = selectedIds.has(card.applicationId)
            return (
              <tr
                key={card.applicationId}
                className={cn(
                  'hover:bg-muted/30 transition-colors',
                  selected && 'bg-primary/5',
                )}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(v) =>
                      onToggleSelect(card.applicationId, v === true)
                    }
                    aria-label={`Select ${card.firstName} ${card.lastName}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/candidates/${card.candidateId}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {card.firstName} {card.lastName}
                  </Link>
                  {card.currentPosition && (
                    <p className="text-xs text-muted-foreground">{card.currentPosition}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-foreground">{card.vacancyTitle}</td>
                <td className="px-3 py-2">
                  {status ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: style.pillBg, color: style.pillText }}
                    >
                      {status.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="text-xs"
                    style={{
                      color: time.isStale ? STALE_TEXT : undefined,
                      fontWeight: time.isStale ? 600 : undefined,
                    }}
                  >
                    {time.label}
                    {time.isStale ? ' · stale' : ''}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-semibold tabular-nums text-foreground">
                  {fitLabel}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {card.source ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {sorted.length === 0 && (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          No candidates match the current filter.
        </div>
      )}
    </div>
  )
}

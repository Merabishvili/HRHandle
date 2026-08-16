'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle, isTerminalStage, STALE_TEXT } from '@/lib/pipeline/stage-style'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import { timeInStage } from '@/lib/pipeline/time-in-stage'
import { toDisplayName } from '@/lib/format-name'
import { cn } from '@/lib/utils'
import type { CrossVacancyCardData } from './cross-vacancy-card'

interface ListViewProps {
  cards: CrossVacancyCardData[]
  statuses: ApplicationStatus[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
  onToggleAll: (allSelected: boolean) => void
  /** Stage-header label override (per-vacancy custom stage names). Defaults to
   * the canonical status label. */
  stageLabelFor?: (status: ApplicationStatus) => string
}

/**
 * Wave 2.1 — List view alternative to the Board.
 *
 * Grouped by stage to mirror the Board's columns: one header row per active
 * stage (name + count) followed by that stage's candidate rows (including
 * empty-stage headers), then a collapsible "Closed" section for
 * Rejected/Withdrawn — those never blend into the active groups. Stage + Fit
 * render real per-candidate data.
 */
export function ListView({
  cards,
  statuses,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  stageLabelFor,
}: ListViewProps) {
  const t = useTranslations()
  const [closedOpen, setClosedOpen] = useState(false)

  // Per-vacancy cards carry a unique `stageId`; group by it so custom stages
  // sharing a canonical bucket don't merge. The cross-vacancy board omits
  // stageId → we fall back to grouping by `stageCode` (unchanged behaviour).
  const useStageId = cards.some((c) => c.stageId != null)
  const cardKey = (c: CrossVacancyCardData) => (useStageId ? c.stageId ?? c.stageCode : c.stageCode)
  const statusKey = (s: ApplicationStatus) => (useStageId ? s.id : s.code)
  const label = (s: ApplicationStatus) => (stageLabelFor ? stageLabelFor(s) : statusLabel(t, s.code, s.name))

  // `statuses` arrives sorted by sort_order. Split active vs terminal so the
  // active groups mirror the Board columns and closed outcomes stay separate.
  const activeStages = statuses.filter((s) => !isTerminalStage(s.code))
  const terminalStages = statuses.filter((s) => isTerminalStage(s.code))

  const byKey = new Map<string, CrossVacancyCardData[]>()
  for (const c of cards) {
    const k = cardKey(c)
    const arr = byKey.get(k) ?? []
    arr.push(c)
    byKey.set(k, arr)
  }

  const activeCards = cards.filter((c) => !isTerminalStage(c.stageCode))
  const closedCards = cards.filter((c) => isTerminalStage(c.stageCode))
  const allSelected =
    activeCards.length > 0 && activeCards.every((c) => selectedIds.has(c.applicationId))

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => onToggleAll(v === true)}
                  aria-label={t('listView.selectAll')}
                />
              </th>
              <th className="px-3 py-2.5">{t('listView.candidate')}</th>
              <th className="px-3 py-2.5">{t('candWizard.review.vacancy')}</th>
              <th className="px-3 py-2.5">{t('listView.inStage')}</th>
              <th className="px-3 py-2.5">{t('listView.fit')}</th>
              <th className="px-3 py-2.5">{t('candWizard.application.sourceLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {activeStages.map((stage) => {
              const rows = byKey.get(statusKey(stage)) ?? []
              const style = getStageStyle(stage.code)
              return (
                <Fragment key={stage.id}>
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={6} className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: style.pillBg, color: style.pillText }}
                        >
                          {label(stage)}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {rows.length}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-center text-xs text-muted-foreground/60">
                        {t('pipeline.noCandidates')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((card) => (
                      <CandidateRow
                        key={card.applicationId}
                        card={card}
                        selected={selectedIds.has(card.applicationId)}
                        onToggleSelect={onToggleSelect}
                      />
                    ))
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Closed — Rejected / Withdrawn, collapsed by default and excluded from
          the active groups above. */}
      {closedCards.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-dashed border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setClosedOpen((v) => !v)}
            aria-expanded={closedOpen}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            <ChevronRight
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', closedOpen && 'rotate-90')}
              aria-hidden
            />
            <span className="text-sm font-bold text-foreground">{t('pipeline.closed')}</span>
            <span className="text-xs text-muted-foreground">
              {terminalStages
                .map((s) => `${label(s)} ${byKey.get(statusKey(s))?.length ?? 0}`)
                .join(' · ')}
            </span>
          </button>
          {closedOpen && (
            <table className="min-w-full border-t border-border text-sm">
              <tbody>
                {closedCards.map((card) => {
                  const style = getStageStyle(card.stageCode)
                  const time = timeInStage(card.inStageSince)
                  return (
                    <tr key={card.applicationId} className="border-t border-border first:border-t-0">
                      <td className="px-3 py-2">
                        <Link
                          href={`/candidates/${card.candidateId}`}
                          className="font-medium text-foreground/90 hover:underline"
                        >
                          {toDisplayName(card.firstName)} {toDisplayName(card.lastName)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{card.vacancyTitle}</td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: style.pillBg, color: style.pillText }}
                        >
                          {(() => {
                            const s = terminalStages.find((x) =>
                              useStageId ? x.id === card.stageId : x.code === card.stageCode,
                            )
                            return s ? label(s) : statusLabel(t, card.stageCode, card.stageCode)
                          })()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {card.rejectionReason
                          ? t('listView.reason', { reason: card.rejectionReason })
                          : t('pipeline.timeAgo', { time: time.label })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  card,
  selected,
  onToggleSelect,
}: {
  card: CrossVacancyCardData
  selected: boolean
  onToggleSelect: (id: string, next: boolean) => void
}) {
  const t = useTranslations()
  const time = timeInStage(card.inStageSince)
  const isStale = time.isStale && !isTerminalStage(card.stageCode)
  const fitLabel = card.fitScore === null ? '—' : card.fitScore.toFixed(1)
  const isFresh =
    card.stageCode === 'applied' &&
    Date.now() - new Date(card.appliedAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <tr className={cn('border-t border-border transition-colors hover:bg-muted/30', selected && 'bg-primary/5')}>
      <td className="px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(card.applicationId, v === true)}
          aria-label={t('pipeline.selectNamed', { name: `${card.firstName} ${card.lastName}` })}
        />
      </td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5">
          <Link
            href={`/candidates/${card.candidateId}`}
            className="truncate font-medium text-foreground hover:underline"
          >
            {toDisplayName(card.firstName)} {toDisplayName(card.lastName)}
          </Link>
          {isFresh && (
            <span className="shrink-0 rounded bg-[oklch(0.93_0.05_250)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[oklch(0.42_0.16_250)]">
              {t('pipeline.newBadge')}
            </span>
          )}
        </span>
        {card.currentPosition && (
          <p className="text-xs text-muted-foreground">{card.currentPosition}</p>
        )}
      </td>
      <td className="px-3 py-2 text-foreground">{card.vacancyTitle}</td>
      <td className="px-3 py-2">
        <span
          className="text-xs"
          style={{ color: isStale ? STALE_TEXT : undefined, fontWeight: isStale ? 600 : undefined }}
        >
          {time.label}
          {isStale ? t('listView.staleSuffix') : ''}
        </span>
      </td>
      <td className="px-3 py-2 text-xs font-semibold tabular-nums text-foreground">{fitLabel}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{card.source ?? '—'}</td>
    </tr>
  )
}

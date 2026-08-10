'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Checkbox } from '@/components/ui/checkbox'
import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import { timeInStage } from '@/lib/pipeline/time-in-stage'
import { toDisplayName } from '@/lib/format-name'
import { cn } from '@/lib/utils'

export interface TerminalCount {
  statusId: string
  code: ApplicationStatus['code']
  name: string
  count: number
}

/** A single closed (rejected / withdrawn) candidate, listed when the rail is
 * expanded so the recruiter can see who was closed and why. */
export interface ClosedCandidate {
  applicationId: string
  candidateId: string
  name: string
  vacancyTitle: string
  /** Terminal status code this candidate sits in (rejected | withdrawn). */
  code: ApplicationStatus['code']
  /** Rejection reason name, when one was recorded. */
  reason: string | null
  /** Timestamp the card entered its current (terminal) stage. */
  inStageSince: string
}

interface TerminalRailProps {
  terminals: TerminalCount[]
  /** Closed candidates, listed under their outcome when expanded. */
  closed: ClosedCandidate[]
  /** Selection state, shared with the rest of the board so the bulk bar
   * works identically for closed-stage cards. */
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
  /** Status id currently hovered during a DnD operation — applied as a ring
   * on the matching column so the recruiter sees where the card lands. */
  overStatusId?: string | null
  /** Force-expand while a card is being dragged so Rejected / Withdrawn are
   * droppable without the recruiter first clicking the rail open. */
  isDragging?: boolean
}

/**
 * Pipeline Closed Expanded.dc.html — the terminal (Rejected / Withdrawn) group.
 *
 * Collapsed it's a thin vertical rail ("Rejected N · Withdrawn N") pinned to
 * the far right of the board (the board keeps it outside its horizontal scroll
 * container so it's always visible). Expanded it opens INLINE as its own
 * bordered group — a "CLOSED" header over Rejected & Withdrawn rendered as
 * normal-width columns. It never floats over the board or clips. Rejected
 * cards carry a red spine + the rejection reason; closed cards are dimmed but
 * still selectable, and each column is a drop target.
 *
 * Exported `terminalSummary` is the pure label builder — unit-tested. The
 * optional `labelFor` resolver lets callers localize the outcome name
 * (Rejected / Withdrawn); it defaults to the raw DB name so the pure test
 * and any English callers keep working.
 */
export function terminalSummary(
  terminals: TerminalCount[],
  labelFor: (t: TerminalCount) => string = (t) => t.name,
): string {
  return terminals.map((t) => `${labelFor(t)} ${t.count}`).join(' · ')
}

export function TerminalRail({
  terminals,
  closed,
  selectedIds,
  onToggleSelect,
  overStatusId,
  isDragging,
}: TerminalRailProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const expanded = open || !!isDragging
  const summary = terminalSummary(terminals, (term) => statusLabel(t, term.code, term.name))

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('pipeline.showClosed', { summary })}
        className="flex w-11 shrink-0 items-center justify-center self-stretch rounded-xl border border-dashed border-border bg-muted/40 py-3 transition-colors hover:bg-muted"
      >
        <span
          className="text-xs font-medium tracking-wide text-muted-foreground"
          style={{ writingMode: 'vertical-rl' }}
        >
          {summary}
        </span>
      </button>
    )
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 self-stretch rounded-xl border border-border bg-muted/30 p-2.5">
      <div className="flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('pipeline.collapseClosed')}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[11.5px] font-bold uppercase tracking-[0.05em]">{t('pipeline.closed')}</span>
        </button>
        {!isDragging && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('pipeline.collapse')}
          </button>
        )}
      </div>

      <div className="flex gap-2.5">
        {terminals.map((t) => (
          <TerminalColumn
            key={t.statusId}
            terminal={t}
            items={closed.filter((c) => c.code === t.code)}
            isOver={overStatusId === t.statusId}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  )
}

function TerminalColumn({
  terminal,
  items,
  isOver,
  selectedIds,
  onToggleSelect,
}: {
  terminal: TerminalCount
  items: ClosedCandidate[]
  isOver: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
}) {
  const t = useTranslations()
  const { setNodeRef } = useDroppable({ id: terminal.statusId })
  const style = getStageStyle(terminal.code)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[210px] shrink-0 flex-col gap-2 rounded-lg border p-2.5 transition-shadow',
        isOver && 'ring-2 ring-primary/60',
      )}
      style={{ background: style.columnBg, borderColor: style.columnBorder, minHeight: 150 }}
    >
      <div className="flex items-center justify-between px-1">
        <span
          className="rounded-md px-2.5 py-0.5 text-[12px] font-semibold"
          style={{ background: style.pillBg, color: style.pillText }}
        >
          {statusLabel(t, terminal.code, terminal.name)}
        </span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: style.pillText }}>
          {terminal.count}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground/60">
          {t('pipeline.none')}
        </div>
      ) : (
        items.map((c) => (
          <ClosedCard
            key={c.applicationId}
            item={c}
            spine={style.spine}
            reasonColor={style.pillText}
            selected={selectedIds.has(c.applicationId)}
            onToggleSelect={onToggleSelect}
          />
        ))
      )}
    </div>
  )
}

function ClosedCard({
  item,
  spine,
  reasonColor,
  selected,
  onToggleSelect,
}: {
  item: ClosedCandidate
  spine: string
  reasonColor: string
  selected: boolean
  onToggleSelect: (id: string, next: boolean) => void
}) {
  const t = useTranslations()
  const time = timeInStage(item.inStageSince)
  const metaLabel = item.reason
    ? t('pipeline.reasonAgo', { reason: item.reason, time: time.label })
    : t('pipeline.timeAgo', { time: time.label })
  return (
    <div
      className={cn(
        'rounded-md border bg-card p-2.5 opacity-90 transition-colors',
        selected ? 'border-primary/60 opacity-100 ring-2 ring-primary/20' : 'border-border',
      )}
      style={{ borderLeft: `3px solid ${spine}` }}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(item.applicationId, v === true)}
          aria-label={t('pipeline.selectNamed', { name: item.name })}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/candidates/${item.candidateId}`}
            className="block truncate text-[12.5px] font-medium text-foreground hover:underline"
          >
            {toDisplayName(item.name)}
          </Link>
          <p className="truncate text-[11px] text-muted-foreground">{item.vacancyTitle}</p>
        </div>
      </div>
      <p
        className="mt-1.5 truncate text-[11px]"
        style={{ color: item.reason ? reasonColor : undefined }}
      >
        {metaLabel}
      </p>
    </div>
  )
}

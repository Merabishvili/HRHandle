'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle } from '@/lib/pipeline/stage-style'
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
  /** Terminal status code this candidate sits in (rejected | withdrawn). */
  code: ApplicationStatus['code']
  /** Rejection reason name, when one was recorded. */
  reason: string | null
}

interface TerminalRailProps {
  terminals: TerminalCount[]
  /** Closed candidates, listed under their outcome when expanded. */
  closed: ClosedCandidate[]
  /** Status id currently hovered during a DnD operation — applied as a ring
   * on the matching drop header so the recruiter sees where the card lands. */
  overStatusId?: string | null
  /** Force-expand while a card is being dragged so Rejected / Withdrawn are
   * droppable without the recruiter first clicking the rail open. */
  isDragging?: boolean
}

/**
 * Pipeline Page Fixed.dc.html — collapsed terminal rail.
 *
 * Rejected + Withdrawn don't earn full columns; they collapse into a thin
 * vertical rail pinned to the far right of the board (vertical text:
 * "Rejected N · Withdrawn N"). The board keeps the rail OUTSIDE its
 * horizontal scroll container so it's always fully visible. Clicking expands
 * it into a normal-width column that lists each closed candidate under its
 * outcome (with the rejection reason); a drag force-expands it so a card can
 * be dropped straight onto an outcome.
 *
 * Exported `terminalSummary` is the pure label builder — unit-tested.
 */
export function terminalSummary(terminals: TerminalCount[]): string {
  return terminals.map((t) => `${t.name} ${t.count}`).join(' · ')
}

export function TerminalRail({ terminals, closed, overStatusId, isDragging }: TerminalRailProps) {
  const [open, setOpen] = useState(false)
  const expanded = open || !!isDragging
  const summary = terminalSummary(terminals)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Show closed outcomes — ${summary}`}
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
    <div className="flex max-h-[72vh] w-[244px] shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-dashed border-border bg-muted/30 p-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Closed
        </span>
        {!isDragging && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse closed outcomes"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {terminals.map((t) => (
        <TerminalSection
          key={t.statusId}
          terminal={t}
          isOver={overStatusId === t.statusId}
          items={closed.filter((c) => c.code === t.code)}
        />
      ))}
    </div>
  )
}

function TerminalSection({
  terminal,
  isOver,
  items,
}: {
  terminal: TerminalCount
  isOver: boolean
  items: ClosedCandidate[]
}) {
  const { setNodeRef } = useDroppable({ id: terminal.statusId })
  const style = getStageStyle(terminal.code)
  return (
    <div className="flex flex-col gap-1.5">
      {/* Droppable header — drag a card here to close the candidate. */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex items-center justify-between rounded-lg border px-2.5 py-2 transition-shadow',
          isOver && 'ring-2 ring-primary/60',
        )}
        style={{ background: style.columnBg, borderColor: style.columnBorder }}
      >
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: style.pillBg, color: style.pillText }}
        >
          {terminal.name}
        </span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: style.pillText }}>
          {terminal.count}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-1 text-[11px] text-muted-foreground/60">None</p>
      ) : (
        items.map((c) => (
          <div
            key={c.applicationId}
            className="rounded-md border border-border bg-card px-2.5 py-1.5"
            style={{ borderLeft: `3px solid ${style.spine}` }}
          >
            <Link
              href={`/candidates/${c.candidateId}`}
              className="block truncate text-[12px] font-medium text-foreground hover:underline"
            >
              {toDisplayName(c.name)}
            </Link>
            {c.reason && (
              <p className="truncate text-[11px] text-muted-foreground">{c.reason}</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight } from 'lucide-react'

import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { cn } from '@/lib/utils'

export interface TerminalCount {
  statusId: string
  code: ApplicationStatus['code']
  name: string
  count: number
}

interface TerminalRailProps {
  terminals: TerminalCount[]
  /** Status id currently hovered during a DnD operation — applied as a ring
   * on the matching drop tile so the recruiter sees where the card lands. */
  overStatusId?: string | null
  /** Force-expand while a card is being dragged so Rejected / Withdrawn are
   * droppable without the recruiter first clicking the rail open. */
  isDragging?: boolean
}

/**
 * Pipeline Page Fixed.dc.html — collapsed terminal rail.
 *
 * Rejected + Withdrawn don't earn full columns; they collapse into a thin
 * vertical rail pinned to the far right of the board row (vertical text:
 * "Rejected N · Withdrawn N"). Clicking expands it into a narrow panel of
 * droppable outcome tiles; an in-progress drag force-expands it so the
 * recruiter can still drop a card straight onto an outcome.
 *
 * Exported `terminalSummary` is the pure label builder — unit-tested.
 */
export function terminalSummary(terminals: TerminalCount[]): string {
  return terminals.map((t) => `${t.name} ${t.count}`).join(' · ')
}

export function TerminalRail({ terminals, overStatusId, isDragging }: TerminalRailProps) {
  const [open, setOpen] = useState(false)
  const expanded = open || !!isDragging
  const summary = terminalSummary(terminals)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Show closed outcomes — ${summary}`}
        className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 py-3 transition-colors hover:bg-muted"
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
    <div className="flex w-[176px] shrink-0 flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-2.5">
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
        <TerminalDropTile
          key={t.statusId}
          terminal={t}
          isOver={overStatusId === t.statusId}
        />
      ))}
    </div>
  )
}

function TerminalDropTile({ terminal, isOver }: { terminal: TerminalCount; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: terminal.statusId })
  const style = getStageStyle(terminal.code)
  return (
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
  )
}

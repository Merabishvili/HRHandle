'use client'

import { useDroppable } from '@dnd-kit/core'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import type { ApplicationStatus } from '@/lib/types/application'
import { cn } from '@/lib/utils'

interface FooterCount {
  statusId: string
  code: ApplicationStatus['code']
  name: string
  count: number
}

interface FooterCounterStripProps {
  terminals: FooterCount[]
  /** Status id currently hovered during a DnD operation — applied as an
   * outline so the recruiter sees which footer chip will receive the
   * card if they release. */
  overStatusId?: string | null
}

/**
 * A-1c — Footer counter strip for Rejected + Withdrawn outcomes.
 *
 * Per `Pipeline Versions.dc.html` §3, the active stages + Hired live
 * as full columns; the two "no-hire" outcomes are condensed into small
 * chips below the board so they don't compete with the working
 * surface for horizontal space. Each chip is still a droppable target
 * for DnD so the recruiter can drag a card straight onto Rejected /
 * Withdrawn without expanding anything.
 */
export function FooterCounterStrip({ terminals, overStatusId }: FooterCounterStripProps) {
  return (
    <div
      className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-2.5"
      aria-label="Closed outcomes"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Closed
      </span>
      {terminals.map((t) => (
        <FooterChip key={t.statusId} terminal={t} isOver={overStatusId === t.statusId} />
      ))}
    </div>
  )
}

function FooterChip({ terminal, isOver }: { terminal: FooterCount; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: terminal.statusId })
  const colorClass =
    APPLICATION_STATUS_COLORS[terminal.code] ?? 'bg-muted text-muted-foreground'
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
        colorClass,
        isOver && 'ring-2 ring-primary/60',
      )}
    >
      <span>{terminal.name}</span>
      <span className="tabular-nums opacity-70">· {terminal.count}</span>
    </div>
  )
}

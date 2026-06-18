'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'

import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import type { ApplicationStatus } from '@/lib/types/application'
import { cn } from '@/lib/utils'

interface TerminalCount {
  statusId: string
  code: ApplicationStatus['code']
  name: string
  count: number
}

interface TerminalRailProps {
  terminals: TerminalCount[]
  /** Optional outcome statuses (hired/rejected/withdrawn) the recruiter can
   * still drop cards onto. Each rail tile is a droppable target so DnD keeps
   * working without expanding the rail. */
  overStatusId?: string | null
}

/**
 * Wave 2.1 — collapsed terminal-stage rail at the right of the kanban.
 *
 * Hired / Rejected / Withdrawn shouldn't eat as much horizontal space as
 * active stages — they're outcomes, not the working surface. Render each as
 * a thin tile with name + count, side-by-side in a fixed-width column. The
 * rail itself can be collapsed (chevron toggle) for an even tighter view.
 *
 * Each tile is a droppable target so the recruiter can still drag a card
 * onto "Rejected" / "Hired" / "Withdrawn" without the parent board having
 * to render the full column.
 */
export function TerminalRail({ terminals, overStatusId }: TerminalRailProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (terminals.length === 0) return null

  return (
    <aside
      aria-label="Terminal stages"
      className={cn(
        'flex shrink-0 flex-col gap-2 rounded-lg border border-border bg-card transition-all',
        collapsed ? 'w-12 p-2' : 'w-44 p-2.5',
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Expand terminal stages' : 'Collapse terminal stages'}
        aria-expanded={!collapsed}
        className="flex items-center gap-1 self-end rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {collapsed ? (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      <ul className="flex flex-col gap-1.5">
        {terminals.map((t) => (
          <TerminalTile
            key={t.statusId}
            terminal={t}
            collapsed={collapsed}
            isOver={overStatusId === t.statusId}
          />
        ))}
      </ul>
    </aside>
  )
}

function TerminalTile({
  terminal,
  collapsed,
  isOver,
}: {
  terminal: TerminalCount
  collapsed: boolean
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: terminal.statusId })
  const colorClass = APPLICATION_STATUS_COLORS[terminal.code] ?? 'bg-muted text-muted-foreground'

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs font-medium transition-colors',
        colorClass,
        isOver && 'border-primary/60 ring-2 ring-primary/30',
        collapsed && 'flex-col justify-center gap-0.5 px-0 py-2',
      )}
    >
      {!collapsed && <span className="truncate flex-1">{terminal.name}</span>}
      <span className={cn('tabular-nums', collapsed ? 'text-base font-semibold' : 'text-xs')}>
        {terminal.count}
      </span>
      {collapsed && (
        <span className="text-[9.5px] uppercase tracking-wider opacity-70">
          {terminal.name.slice(0, 3)}
        </span>
      )}
    </li>
  )
}

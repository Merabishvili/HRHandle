'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { CrossVacancyCard, type CrossVacancyCardData } from './cross-vacancy-card'
import type { ApplicationStatus } from '@/lib/types/application'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { cn } from '@/lib/utils'

interface TintedKanbanColumnProps {
  status: ApplicationStatus
  cards: CrossVacancyCardData[]
  isOver: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
}

/**
 * Wave 2.1 Version B — colour-tinted stage column.
 *
 * Renders one stage's worth of cross-vacancy cards. Column background is
 * the stage's pale hue, border one stop darker, header pill the badge
 * colour. The column body is a droppable target (DnD); cards inside are
 * sortable. Empty columns still render so the recruiter can drop cards
 * into a stage that currently has zero candidates.
 */
export function TintedKanbanColumn({
  status,
  cards,
  isOver,
  selectedIds,
  onToggleSelect,
}: TintedKanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status.id })
  const style = getStageStyle(status.code)

  return (
    <div
      className="flex min-w-[210px] flex-1 flex-col rounded-xl border p-2.5 transition-colors"
      style={{
        background: style.columnBg,
        borderColor: isOver ? style.spine : style.columnBorder,
        boxShadow: isOver ? `inset 0 0 0 1px ${style.spine}` : undefined,
      }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ background: style.pillBg, color: style.pillText }}
        >
          {status.name}
        </span>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: style.pillText }}
        >
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn('flex min-h-[140px] flex-1 flex-col gap-2 rounded-md p-0.5')}
      >
        <SortableContext
          items={cards.map((c) => c.applicationId)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <CrossVacancyCard
              key={card.applicationId}
              data={card}
              selected={selectedIds.has(card.applicationId)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center px-2 py-4 text-center text-xs text-muted-foreground/60">
            No candidates
          </div>
        )}
      </div>
    </div>
  )
}

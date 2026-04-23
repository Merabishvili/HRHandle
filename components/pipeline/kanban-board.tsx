'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { KanbanColumn } from './kanban-column'
import { CandidateCard } from './candidate-card'
import { updateApplicationStatus } from '@/lib/actions/applications'
import type { ApplicationStatus } from '@/lib/types/application'

interface PipelineApplication {
  id: string
  candidate_id: string
  status_id: string | null
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  last_status_changed_at: string | null
  applied_at: string
}

interface KanbanBoardProps {
  statuses: ApplicationStatus[]
  initialApplications: PipelineApplication[]
}

export function KanbanBoard({ statuses, initialApplications }: KanbanBoardProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [activeApp, setActiveApp] = useState<PipelineApplication | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const getColumnId = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      return app?.status_id ?? statuses[0]?.id ?? null
    },
    [applications, statuses]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const app = applications.find((a) => a.id === event.active.id)
    setActiveApp(app ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverId(null); return }
    const isColumn = statuses.some((s) => s.id === over.id)
    setOverId(isColumn ? String(over.id) : getColumnId(String(over.id)))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveApp(null)
    setOverId(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const isColumn = statuses.some((s) => s.id === overId)
    const targetColumnId = isColumn ? overId : getColumnId(overId)

    if (!targetColumnId) return

    const activeApp = applications.find((a) => a.id === activeId)
    if (!activeApp) return
    if (activeApp.status_id === targetColumnId) return

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) =>
        a.id === activeId
          ? { ...a, status_id: targetColumnId, last_status_changed_at: new Date().toISOString() }
          : a
      )
    )

    const result = await updateApplicationStatus(activeId, targetColumnId)
    if (!result.success) {
      // Revert on failure
      setApplications(initialApplications)
    }
  }

  const getAppsForColumn = (statusId: string) =>
    applications.filter((a) => a.status_id === statusId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            applications={getAppsForColumn(status.id)}
            isOver={overId === status.id}
          />
        ))}
      </div>

      <DragOverlay>
        {activeApp && (
          <div className="rotate-2 opacity-90">
            <CandidateCard
              applicationId={activeApp.id}
              candidateId={activeApp.candidate_id}
              firstName={activeApp.first_name}
              lastName={activeApp.last_name}
              currentPosition={activeApp.current_position}
              currentCompany={activeApp.current_company}
              lastStatusChangedAt={activeApp.last_status_changed_at}
              appliedAt={activeApp.applied_at}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

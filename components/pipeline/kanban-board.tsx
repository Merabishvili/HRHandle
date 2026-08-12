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
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { KanbanColumn, type PipelineColumn } from './kanban-column'
import { CandidateCard } from './candidate-card'
import { RejectionDialog, type RejectionReason, type RejectionTemplate } from './rejection-dialog'
import { updateApplicationPipelineStage } from '@/lib/actions/applications'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'

interface PipelineApplication {
  id: string
  candidate_id: string
  /** Wave 2.6 Slice 2b — the per-vacancy stage this app sits in.
   * The board no longer reads the legacy `status_id` for placement. */
  pipeline_stage_id: string | null
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  last_status_changed_at: string | null
  applied_at: string
}

interface KanbanBoardProps {
  /** Ordered list of the vacancy's pipeline_stages rows. Drives the
   * column layout. */
  columns: PipelineColumn[]
  initialApplications: PipelineApplication[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  /** Canonical `application_statuses.id` for code='rejected'. Required for
   * the rejection-dialog handoff — that action still keys off the legacy
   * status_id even though the board lives on pipeline_stage_id. The
   * parent server component resolves it once and threads it through. */
  rejectedStatusId: string | null
}

interface PendingRejection {
  applicationId: string
  /** Canonical `application_statuses.id` (always rejected). */
  statusId: string
  /** The specific per-vacancy `pipeline_stages.id` the recruiter dropped
   * onto. May be a custom "Closed - not a fit" stage rather than the
   * default "Rejected" — `rejectApplication`'s new `targetPipelineStageId`
   * param preserves the recruiter's choice. */
  targetPipelineStageId: string
  candidateName: string
}

export function KanbanBoard({
  columns,
  initialApplications,
  rejectionReasons,
  rejectionTemplates,
  rejectedStatusId,
}: KanbanBoardProps) {
  const t = useTranslations()
  const [applications, setApplications] = useState(initialApplications)
  const [activeApp, setActiveApp] = useState<PipelineApplication | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const getColumnId = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      return app?.pipeline_stage_id ?? columns[0]?.id ?? null
    },
    [applications, columns]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const app = applications.find((a) => a.id === event.active.id)
    setActiveApp(app ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverId(null); return }
    const isColumn = columns.some((c) => c.id === over.id)
    setOverId(isColumn ? String(over.id) : getColumnId(String(over.id)))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveApp(null)
    setOverId(null)

    if (!over) return

    const activeId = String(active.id)
    const overIdStr = String(over.id)

    const isColumn = columns.some((c) => c.id === overIdStr)
    const targetColumnId = isColumn ? overIdStr : getColumnId(overIdStr)

    if (!targetColumnId) return

    const app = applications.find((a) => a.id === activeId)
    if (!app) return
    if (app.pipeline_stage_id === targetColumnId) return

    const targetColumn = columns.find((c) => c.id === targetColumnId)
    if (!targetColumn) return

    // Bucket-map the target column to a canonical code so we know whether
    // this is a rejection drop (which needs the reason/template dialog
    // before the action runs).
    const targetCanonicalCode = mapPipelineStageToBucket({
      type: targetColumn.type,
      name: targetColumn.name,
      is_terminal: targetColumn.is_terminal,
    })

    if (targetCanonicalCode === 'rejected' && rejectedStatusId) {
      setPendingRejection({
        applicationId: activeId,
        statusId: rejectedStatusId,
        targetPipelineStageId: targetColumnId,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
      return
    }

    // Optimistic update for non-rejection moves.
    setApplications((prev) =>
      prev.map((a) =>
        a.id === activeId
          ? {
              ...a,
              pipeline_stage_id: targetColumnId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a
      )
    )

    const result = await updateApplicationPipelineStage(activeId, targetColumnId)
    if (!result.success) {
      setApplications(initialApplications)
      toast.error(t('kanban.updateFailed'))
    }
  }

  const handleRejectionSuccess = () => {
    if (!pendingRejection) return
    // Move card to the recruiter's chosen rejection column.
    setApplications((prev) =>
      prev.map((a) =>
        a.id === pendingRejection.applicationId
          ? {
              ...a,
              pipeline_stage_id: pendingRejection.targetPipelineStageId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a
      )
    )
    setPendingRejection(null)
  }

  const handleRejectionCancel = () => {
    setPendingRejection(null)
  }

  const getAppsForColumn = (columnId: string) =>
    applications.filter((a) => a.pipeline_stage_id === columnId)

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              applications={getAppsForColumn(column.id)}
              isOver={overId === column.id}
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

      {pendingRejection && (
        <RejectionDialog
          open={!!pendingRejection}
          applicationId={pendingRejection.applicationId}
          statusId={pendingRejection.statusId}
          targetPipelineStageId={pendingRejection.targetPipelineStageId}
          candidateName={pendingRejection.candidateName}
          reasons={rejectionReasons}
          templates={rejectionTemplates}
          onSuccess={handleRejectionSuccess}
          onCancel={handleRejectionCancel}
        />
      )}
    </>
  )
}

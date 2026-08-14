'use client'

import { useCallback, useMemo, useState } from 'react'
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

import { TintedKanbanColumn } from './tinted-kanban-column'
import { CrossVacancyCard, type CrossVacancyCardData } from './cross-vacancy-card'
import {
  RejectionDialog,
  type RejectionReason,
  type RejectionTemplate,
} from './rejection-dialog'
import { updateApplicationPipelineStage } from '@/lib/actions/applications'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import type { PipelineStageType } from '@/lib/pipeline-stage-templates/types'

/** One of the vacancy's `pipeline_stages` rows — the columns of this board. */
export interface PipelineColumn {
  id: string
  name: string
  type: PipelineStageType
  is_terminal: boolean
  sort_order: number
}

export interface VacancyPipelineApplication {
  id: string
  candidate_id: string
  /** The per-vacancy stage this app sits in (drives placement). */
  pipeline_stage_id: string | null
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  /** Short source label ("LinkedIn", "Apply link", …) or null. */
  source: string | null
  /** 0–10 fit score from submitted reviewer cards, or null. */
  fit_score: number | null
  last_status_changed_at: string | null
  applied_at: string
}

interface VacancyPipelineBoardProps {
  /** Ordered list of the vacancy's pipeline_stages — the columns. */
  columns: PipelineColumn[]
  initialApplications: VacancyPipelineApplication[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  /** Canonical `application_statuses.id` for code='rejected' — the rejection
   * dialog still keys off the legacy status id even though placement lives on
   * pipeline_stage_id. */
  rejectedStatusId: string | null
}

interface PendingRejection {
  applicationId: string
  statusId: string
  targetPipelineStageId: string
  candidateName: string
}

/**
 * Per-vacancy pipeline board. Wave-2.6 custom `pipeline_stages` as columns,
 * but rendered with the same visual language as the cross-vacancy board
 * (`TintedKanbanColumn` + `CrossVacancyCard`) so both pipeline surfaces look
 * identical. Each custom stage bucket-maps to a canonical code for its tint /
 * card spine, while the column header keeps the stage's real (custom) name.
 *
 * v1 scope: tinted columns, colour-spine cards, drag-to-move, reject-on-drop
 * dialog. Bulk select, review mode, list/density toggles and the terminal
 * rail from the cross-vacancy board are intentionally out (single-vacancy).
 */
export function VacancyPipelineBoard({
  columns,
  initialApplications,
  rejectionReasons,
  rejectionTemplates,
  rejectedStatusId,
}: VacancyPipelineBoardProps) {
  const t = useTranslations()
  const [applications, setApplications] = useState(initialApplications)
  const [activeApp, setActiveApp] = useState<VacancyPipelineApplication | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Canonical bucket code per column — drives the column tint + each card's
  // spine colour so the palette matches the cross-vacancy board.
  const bucketByColumnId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of columns) {
      m.set(c.id, mapPipelineStageToBucket({ type: c.type, name: c.name, is_terminal: c.is_terminal }))
    }
    return m
  }, [columns])

  const firstColumnId = columns[0]?.id ?? null

  const toCardData = useCallback(
    (app: VacancyPipelineApplication): CrossVacancyCardData => {
      const columnId = app.pipeline_stage_id ?? firstColumnId
      return {
        applicationId: app.id,
        candidateId: app.candidate_id,
        firstName: app.first_name,
        lastName: app.last_name,
        // Single vacancy — the role title is redundant, so surface the
        // candidate's current position as the card subtitle instead.
        vacancyTitle: app.current_position ?? '',
        currentPosition: app.current_position,
        source: app.source,
        inStageSince: app.last_status_changed_at ?? app.applied_at,
        appliedAt: app.applied_at,
        stageCode: (columnId && bucketByColumnId.get(columnId)) ?? 'applied',
        fitScore: app.fit_score,
        rejectionReason: null,
      }
    },
    [bucketByColumnId, firstColumnId],
  )

  const cardsByColumnId = useMemo(() => {
    const m = new Map<string, CrossVacancyCardData[]>()
    for (const col of columns) m.set(col.id, [])
    for (const app of applications) {
      const columnId = app.pipeline_stage_id ?? firstColumnId
      if (!columnId) continue
      const arr = m.get(columnId)
      if (arr) arr.push(toCardData(app))
    }
    return m
  }, [applications, columns, firstColumnId, toCardData])

  const getColumnId = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      return app?.pipeline_stage_id ?? firstColumnId
    },
    [applications, firstColumnId],
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveApp(applications.find((a) => a.id === event.active.id) ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverId(null)
      return
    }
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

    // Rejection drops need the reason/template dialog before the action runs.
    if (bucketByColumnId.get(targetColumnId) === 'rejected' && rejectedStatusId) {
      setPendingRejection({
        applicationId: activeId,
        statusId: rejectedStatusId,
        targetPipelineStageId: targetColumnId,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
      return
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.id === activeId
          ? { ...a, pipeline_stage_id: targetColumnId, last_status_changed_at: new Date().toISOString() }
          : a,
      ),
    )

    const result = await updateApplicationPipelineStage(activeId, targetColumnId)
    if (!result.success) {
      setApplications(initialApplications)
      toast.error(t('kanban.updateFailed'))
    }
  }

  const handleRejectionSuccess = () => {
    if (!pendingRejection) return
    setApplications((prev) =>
      prev.map((a) =>
        a.id === pendingRejection.applicationId
          ? {
              ...a,
              pipeline_stage_id: pendingRejection.targetPipelineStageId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a,
      ),
    )
    setPendingRejection(null)
  }

  const noop = useCallback(() => {}, [])
  const emptySelection = useMemo(() => new Set<string>(), [])

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <TintedKanbanColumn
              key={column.id}
              status={{
                id: column.id,
                code: bucketByColumnId.get(column.id) ?? 'applied',
                name: column.name,
              }}
              label={pipelineStageLabel(t, column.name)}
              cards={cardsByColumnId.get(column.id) ?? []}
              isOver={overId === column.id}
              selectedIds={emptySelection}
              onToggleSelect={noop}
              selectable={false}
            />
          ))}
        </div>

        <DragOverlay>
          {activeApp && (
            <div className="rotate-2 opacity-90">
              <CrossVacancyCard
                data={toCardData(activeApp)}
                selected={false}
                onToggleSelect={noop}
                selectable={false}
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
          onCancel={() => setPendingRejection(null)}
        />
      )}
    </>
  )
}

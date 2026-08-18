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
import { BulkBar } from './bulk-bar'
import { ReviewMode } from './review-mode'
import { ListView } from './list-view'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { TerminalRail, type TerminalCount, type ClosedCandidate } from './terminal-rail'
import { type CrossVacancyApplication, TERMINAL_CODES } from './cross-vacancy-derivation'
import { BatchRejectionDialog } from '@/components/vacancies/batch-rejection-dialog'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { updateApplicationPipelineStage } from '@/lib/actions/applications'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'
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
  /** Candidate email — for the bulk Email action. */
  email: string | null
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
  vacancyId: string
  vacancyTitle: string
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
 * Matches the cross-vacancy board's tinted columns, colour-spine cards, bulk
 * bar and drag-to-move; the review mode / list toggle / terminal rail from the
 * home surface are still out (single-vacancy).
 */
export function VacancyPipelineBoard({
  columns,
  initialApplications,
  rejectionReasons,
  rejectionTemplates,
  rejectedStatusId,
  vacancyId,
  vacancyTitle,
}: VacancyPipelineBoardProps) {
  const t = useTranslations()
  const [applications, setApplications] = useState(initialApplications)
  const [activeApp, setActiveApp] = useState<VacancyPipelineApplication | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('board')

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

  // The vacancy's rejected-bucket stage — target for optimistic bulk-reject
  // moves (the server resolves the same default stage).
  const rejectedColumnId = useMemo(
    () => columns.find((c) => bucketByColumnId.get(c.id) === 'rejected')?.id ?? null,
    [columns, bucketByColumnId],
  )

  // Synthetic ApplicationStatus[] built from the columns so the shared BulkBar
  // (which is typed against the canonical status model) can drive per-vacancy
  // stage moves. `id` is the pipeline_stage id (unique, used for targeting);
  // `code` is the bucket (used only for BulkBar's terminal filter).
  const syntheticStatuses = useMemo<ApplicationStatus[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        name: c.name,
        code: (bucketByColumnId.get(c.id) ?? 'applied') as ApplicationStatus['code'],
        is_active: true,
        sort_order: c.sort_order,
      })),
    [columns, bucketByColumnId],
  )

  // Non-terminal stages in order — the review-mode advance path steps through
  // these.
  const activeSyntheticStatuses = useMemo(
    () =>
      syntheticStatuses
        .filter((s) => !TERMINAL_CODES.has(s.code))
        .sort((a, b) => a.sort_order - b.sort_order),
    [syntheticStatuses],
  )

  // "Review new" queue — untouched applicants (never moved stage) sitting in a
  // non-terminal stage, oldest first. Mapped to the cross-vacancy shape the
  // shared ReviewMode expects (status_id = pipeline_stage_id for this board).
  const reviewQueue = useMemo<CrossVacancyApplication[]>(
    () =>
      applications
        .filter((a) => {
          const columnId = a.pipeline_stage_id ?? firstColumnId
          const bucket = columnId ? bucketByColumnId.get(columnId) : null
          return !a.last_status_changed_at && !!bucket && !TERMINAL_CODES.has(bucket as ApplicationStatus['code'])
        })
        .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
        .map((a) => ({
          id: a.id,
          candidate_id: a.candidate_id,
          status_id: a.pipeline_stage_id ?? firstColumnId,
          first_name: a.first_name,
          last_name: a.last_name,
          email: a.email,
          current_position: a.current_position,
          current_company: a.current_company,
          last_status_changed_at: a.last_status_changed_at,
          applied_at: a.applied_at,
          vacancy_id: vacancyId,
          vacancy_title: vacancyTitle,
          source: a.source,
          fit_score: a.fit_score,
          rejection_reason: null,
        })),
    [applications, firstColumnId, bucketByColumnId, vacancyId, vacancyTitle],
  )

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
        stageId: columnId ?? undefined,
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

  // Flat card list for the List view.
  const allCards = useMemo(() => applications.map(toCardData), [applications, toCardData])

  // Rejected/Withdrawn stages collapse into the terminal rail (Hired-bucket
  // stays a normal column, matching the cross-vacancy board); the rest are
  // board columns.
  const isRailBucket = useCallback(
    (columnId: string) => {
      const b = bucketByColumnId.get(columnId)
      return b === 'rejected' || b === 'withdrawn'
    },
    [bucketByColumnId],
  )
  const boardColumns = useMemo(() => columns.filter((c) => !isRailBucket(c.id)), [columns, isRailBucket])
  const railColumns = useMemo(() => columns.filter((c) => isRailBucket(c.id)), [columns, isRailBucket])

  const terminalCounts = useMemo<TerminalCount[]>(
    () =>
      railColumns.map((c) => ({
        statusId: c.id,
        code: (bucketByColumnId.get(c.id) ?? 'rejected') as ApplicationStatus['code'],
        name: c.name,
        count: applications.filter((a) => (a.pipeline_stage_id ?? firstColumnId) === c.id).length,
      })),
    [railColumns, applications, bucketByColumnId, firstColumnId],
  )

  const closedCandidates = useMemo<ClosedCandidate[]>(() => {
    const railIds = new Set(railColumns.map((c) => c.id))
    return applications
      .filter((a) => railIds.has(a.pipeline_stage_id ?? firstColumnId ?? ''))
      .map((a) => {
        const colId = a.pipeline_stage_id ?? firstColumnId
        return {
          applicationId: a.id,
          candidateId: a.candidate_id,
          name: `${a.first_name} ${a.last_name}`.trim(),
          vacancyTitle: a.current_position ?? '',
          code: (colId ? bucketByColumnId.get(colId) : 'rejected') as ApplicationStatus['code'],
          reason: null,
          inStageSince: a.last_status_changed_at ?? a.applied_at,
        }
      })
  }, [railColumns, applications, firstColumnId, bucketByColumnId])

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

  const handleToggleSelect = useCallback((id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }, [])

  const handleToggleAll = useCallback(
    (allSelected: boolean) => setSelectedIds(allSelected ? new Set() : new Set(allCards.map((c) => c.applicationId))),
    [allCards],
  )

  const handleBulkMove = async (targetColumnId: string) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setApplications((prev) =>
      prev.map((a) =>
        ids.includes(a.id)
          ? { ...a, pipeline_stage_id: targetColumnId, last_status_changed_at: new Date().toISOString() }
          : a,
      ),
    )
    const results = await Promise.all(ids.map((id) => updateApplicationPipelineStage(id, targetColumnId)))
    const failed = results.filter((r) => !r.success).length
    if (failed > 0) {
      setApplications(initialApplications)
      toast.error(t('pipeline.toast.moveFailedSome', { failed, total: ids.length }))
    } else {
      toast.success(t('pipeline.toast.moved', { count: ids.length }))
    }
    setSelectedIds(new Set())
  }

  const handleBulkRejectSuccess = () => {
    const ids = new Set(selectedIds)
    if (rejectedColumnId) {
      setApplications((prev) =>
        prev.map((a) =>
          ids.has(a.id)
            ? { ...a, pipeline_stage_id: rejectedColumnId, last_status_changed_at: new Date().toISOString() }
            : a,
        ),
      )
    }
    setSelectedIds(new Set())
  }

  // Review-mode "advance": move the candidate to the next non-terminal stage.
  const handleAdvance = useCallback(
    async (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      if (!app) return
      const curId = app.pipeline_stage_id ?? firstColumnId
      const curIdx = activeSyntheticStatuses.findIndex((s) => s.id === curId)
      const next = activeSyntheticStatuses[curIdx + 1] ?? activeSyntheticStatuses[curIdx]
      if (!next || next.id === app.pipeline_stage_id) {
        toast.info(t('pipeline.toast.finalStage'))
        return
      }
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, pipeline_stage_id: next.id, last_status_changed_at: new Date().toISOString() }
            : a,
        ),
      )
      const result = await updateApplicationPipelineStage(appId, next.id)
      if (!result.success) {
        setApplications(initialApplications)
        toast.error(t('pipeline.toast.advanceFailed'))
      }
    },
    [applications, activeSyntheticStatuses, firstColumnId, initialApplications, t],
  )

  const handleReviewReject = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      if (!app || !rejectedStatusId || !rejectedColumnId) return
      setPendingRejection({
        applicationId: appId,
        statusId: rejectedStatusId,
        targetPipelineStageId: rejectedColumnId,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
    },
    [applications, rejectedStatusId, rejectedColumnId],
  )

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setReviewing(true)}
          disabled={reviewQueue.length === 0}
          aria-label={t('pipeline.enterReviewMode')}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
          {t('pipeline.reviewNew')}
          {reviewQueue.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground">
              {reviewQueue.length}
            </span>
          )}
        </Button>
      </div>

      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
            {boardColumns.map((column) => (
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
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            ))}

            {terminalCounts.length > 0 && (
              <TerminalRail
                terminals={terminalCounts}
                closed={closedCandidates}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                overStatusId={overId}
                isDragging={!!activeApp}
              />
            )}
          </div>

          <DragOverlay>
            {activeApp && (
              <div className="rotate-2 opacity-90">
                <CrossVacancyCard
                  data={toCardData(activeApp)}
                  selected={false}
                  onToggleSelect={() => {}}
                  selectable={false}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <ListView
          cards={allCards}
          statuses={syntheticStatuses}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          stageLabelFor={(s) => pipelineStageLabel(t, s.name)}
        />
      )}

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

      {selectedIds.size > 0 && (
        <BulkBar
          selectedCount={selectedIds.size}
          statuses={syntheticStatuses}
          selected={applications
            .filter((a) => selectedIds.has(a.id))
            .map((a) => ({ applicationId: a.id, candidateId: a.candidate_id, email: a.email }))}
          onMove={handleBulkMove}
          onReject={() => rejectedStatusId && setBulkRejectOpen(true)}
          onClear={() => setSelectedIds(new Set())}
          stageLabelFor={(s) => pipelineStageLabel(t, s.name)}
        />
      )}

      {rejectedStatusId && (
        <BatchRejectionDialog
          open={bulkRejectOpen}
          onOpenChange={setBulkRejectOpen}
          applicationIds={Array.from(selectedIds)}
          rejectedStatusId={rejectedStatusId}
          reasons={rejectionReasons}
          templates={rejectionTemplates}
          onSuccess={handleBulkRejectSuccess}
        />
      )}

      {reviewing && (
        <ReviewMode
          queue={reviewQueue}
          activeStatuses={activeSyntheticStatuses}
          onClose={() => setReviewing(false)}
          onAdvance={handleAdvance}
          onReject={handleReviewReject}
        />
      )}
    </>
  )
}

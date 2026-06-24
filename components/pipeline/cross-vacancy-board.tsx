'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { Plus, Zap, LayoutGrid, List as ListIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  RejectionDialog,
  type RejectionReason,
  type RejectionTemplate,
} from './rejection-dialog'
import { RoleFilterPills, type RoleOption } from './role-filter-pills'
import { TerminalRail } from './terminal-rail'
import { ReviewMode } from './review-mode'
import { TintedKanbanColumn } from './tinted-kanban-column'
import {
  CrossVacancyCard,
  type CrossVacancyCardData,
} from './cross-vacancy-card'
import { ListView } from './list-view'
import { BulkBar } from './bulk-bar'
import { updateApplicationStatus } from '@/lib/actions/applications'
import type { ApplicationStatus } from '@/lib/types/application'

const TERMINAL_CODES: ReadonlySet<ApplicationStatus['code']> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

export interface CrossVacancyApplication {
  id: string
  candidate_id: string
  status_id: string | null
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  last_status_changed_at: string | null
  applied_at: string
  vacancy_id: string
  vacancy_title: string
  /** Short source label ("LinkedIn", "Apply link", etc.) threaded from
   * candidates.source. Null when the recruiter never set it. */
  source: string | null
  /** Optional 0-10 fit score from the most recent candidate_evaluation —
   * surfaced as a pill on compact-density cards. */
  fit_score: number | null
}

interface CrossVacancyBoardProps {
  statuses: ApplicationStatus[]
  roles: RoleOption[]
  initialApplications: CrossVacancyApplication[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
}

interface PendingRejection {
  applicationId: string
  statusId: string
  candidateName: string
}

type ViewMode = 'board' | 'list'

/**
 * Wave 2.1 Version B — colour-coded cross-vacancy kanban with Board/List
 * toggle, density toggle, bulk bar, role filter, terminal rail, and
 * Review mode. Wraps the whole working surface in a single outer card.
 *
 * Reads the design from `redesign/Pipeline Versions.dc.html` — Version B
 * cards (colour spine + tinted column tints) is the comfortable default,
 * Version C compact cards (with fit score pill) the alternative density.
 */
export function CrossVacancyBoard({
  statuses,
  roles,
  initialApplications,
  rejectionReasons,
  rejectionTemplates,
}: CrossVacancyBoardProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [activeApp, setActiveApp] = useState<CrossVacancyApplication | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const statusByCode = useMemo(() => {
    const m = new Map<string, ApplicationStatus>()
    for (const s of statuses) m.set(s.code, s)
    return m
  }, [statuses])

  const statusById = useMemo(() => {
    const m = new Map<string, ApplicationStatus>()
    for (const s of statuses) m.set(s.id, s)
    return m
  }, [statuses])

  const activeStatuses = useMemo(
    () => statuses.filter((s) => !TERMINAL_CODES.has(s.code)),
    [statuses],
  )

  const terminalStatuses = useMemo(
    () => statuses.filter((s) => TERMINAL_CODES.has(s.code)),
    [statuses],
  )

  const filteredApplications = useMemo(() => {
    if (roleFilter.length === 0 || roleFilter.length === roles.length) {
      return applications
    }
    const allow = new Set(roleFilter)
    return applications.filter((a) => allow.has(a.vacancy_id))
  }, [applications, roleFilter, roles.length])

  const cardData: CrossVacancyCardData[] = useMemo(() => {
    return filteredApplications.map((a) => {
      const status = a.status_id ? statusById.get(a.status_id) : null
      return {
        applicationId: a.id,
        candidateId: a.candidate_id,
        firstName: a.first_name,
        lastName: a.last_name,
        vacancyTitle: a.vacancy_title,
        currentPosition: a.current_position,
        source: a.source,
        inStageSince: a.last_status_changed_at ?? a.applied_at,
        appliedAt: a.applied_at,
        stageCode: status?.code ?? activeStatuses[0]?.code ?? 'applied',
        fitScore: a.fit_score,
      }
    })
  }, [filteredApplications, statusById, activeStatuses])

  const cardsByStageCode = useMemo(() => {
    const m = new Map<string, CrossVacancyCardData[]>()
    for (const c of cardData) {
      const arr = m.get(c.stageCode) ?? []
      arr.push(c)
      m.set(c.stageCode, arr)
    }
    return m
  }, [cardData])

  const terminalCounts = useMemo(
    () =>
      terminalStatuses.map((s) => ({
        statusId: s.id,
        code: s.code,
        name: s.name,
        count: filteredApplications.filter((a) => a.status_id === s.id).length,
      })),
    [terminalStatuses, filteredApplications],
  )

  const reviewQueue = useMemo(
    () =>
      filteredApplications
        .filter((a) => {
          const status = a.status_id ? statusById.get(a.status_id) : null
          if (!status || TERMINAL_CODES.has(status.code)) return false
          return !a.last_status_changed_at
        })
        .sort(
          (a, b) =>
            new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime(),
        ),
    [filteredApplications, statusById],
  )

  const getColumnId = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      return app?.status_id ?? statuses[0]?.id ?? null
    },
    [applications, statuses],
  )

  const handleDragStart = (event: DragStartEvent) => {
    const app = applications.find((a) => a.id === event.active.id)
    setActiveApp(app ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverId(null)
      return
    }
    const isColumn = statuses.some((s) => s.id === over.id)
    setOverId(isColumn ? String(over.id) : getColumnId(String(over.id)))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveApp(null)
    setOverId(null)
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    const isColumn = statuses.some((s) => s.id === overIdStr)
    const targetColumnId = isColumn ? overIdStr : getColumnId(overIdStr)
    if (!targetColumnId) return

    const app = applications.find((a) => a.id === activeIdStr)
    if (!app) return
    if (app.status_id === targetColumnId) return

    const targetStatus = statusById.get(targetColumnId)
    if (targetStatus?.code === 'rejected') {
      setPendingRejection({
        applicationId: activeIdStr,
        statusId: targetColumnId,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
      return
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.id === activeIdStr
          ? {
              ...a,
              status_id: targetColumnId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a,
      ),
    )

    const result = await updateApplicationStatus(activeIdStr, targetColumnId)
    if (!result.success) {
      setApplications(initialApplications)
      toast.error('Failed to update status. Please try again.')
    }
  }

  const handleRejectionSuccess = () => {
    if (!pendingRejection) return
    setApplications((prev) =>
      prev.map((a) =>
        a.id === pendingRejection.applicationId
          ? {
              ...a,
              status_id: pendingRejection.statusId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a,
      ),
    )
    setPendingRejection(null)
  }

  const handleAdvance = useCallback(
    async (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      if (!app) return
      const currentStatus = app.status_id ? statusById.get(app.status_id) : null
      const currentIdx = activeStatuses.findIndex((s) => s.id === currentStatus?.id)
      const nextStatus = activeStatuses[currentIdx + 1] ?? activeStatuses[currentIdx]
      if (!nextStatus || nextStatus.id === app.status_id) {
        toast.info('Already in the final active stage.')
        return
      }
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? {
                ...a,
                status_id: nextStatus.id,
                last_status_changed_at: new Date().toISOString(),
              }
            : a,
        ),
      )
      const result = await updateApplicationStatus(appId, nextStatus.id)
      if (!result.success) {
        setApplications(initialApplications)
        toast.error('Failed to advance candidate.')
      }
    },
    [applications, activeStatuses, initialApplications, statusById],
  )

  const handleReviewReject = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      const rejectedStatus = statusByCode.get('rejected')
      if (!app || !rejectedStatus) return
      setPendingRejection({
        applicationId: appId,
        statusId: rejectedStatus.id,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
    },
    [applications, statusByCode],
  )

  const handleToggleSelect = useCallback((id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const updated = new Set(prev)
      if (next) updated.add(id)
      else updated.delete(id)
      return updated
    })
  }, [])

  const handleToggleAll = useCallback(
    (allSelected: boolean) => {
      if (allSelected) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(cardData.map((c) => c.applicationId)))
      }
    },
    [cardData],
  )

  const handleBulkMove = async (statusId: string) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    // Optimistic update first — server actions run in parallel.
    setApplications((prev) =>
      prev.map((a) =>
        ids.includes(a.id)
          ? {
              ...a,
              status_id: statusId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a,
      ),
    )

    const results = await Promise.all(
      ids.map((id) => updateApplicationStatus(id, statusId)),
    )
    const failed = results.filter((r) => !r.success).length
    if (failed > 0) {
      setApplications(initialApplications)
      toast.error(
        `Failed to move ${failed} of ${ids.length} ${ids.length === 1 ? 'candidate' : 'candidates'}.`,
      )
    } else {
      toast.success(`Moved ${ids.length} ${ids.length === 1 ? 'candidate' : 'candidates'}.`)
    }
    setSelectedIds(new Set())
  }

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return
    const rejectedStatus = statusByCode.get('rejected')
    if (!rejectedStatus) return
    const confirmed = confirm(
      `Reject ${selectedIds.size} ${selectedIds.size === 1 ? 'candidate' : 'candidates'}? This won't send an email — open each candidate's profile to send a personalised rejection.`,
    )
    if (!confirmed) return
    await handleBulkMove(rejectedStatus.id)
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
            <p className="text-xs text-muted-foreground">
              {roles.length} open {roles.length === 1 ? 'role' : 'roles'} ·{' '}
              {filteredApplications.length} active{' '}
              {filteredApplications.length === 1 ? 'candidate' : 'candidates'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setReviewing(true)}
              disabled={reviewQueue.length === 0}
              aria-label="Enter Review mode"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Review new
              {reviewQueue.length > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground">
                  {reviewQueue.length}
                </span>
              )}
            </Button>

            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/candidates/new">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add candidate
              </Link>
            </Button>
          </div>
        </div>

        {/* Role-filter pill tabs — Pipeline Versions.dc.html §3 */}
        {roles.length > 0 && (
          <div className="border-b border-border bg-card px-5 py-3">
            <RoleFilterPills
              options={roles}
              value={roleFilter}
              onChange={setRoleFilter}
              totalActive={applications.filter((a) => {
                const status = a.status_id ? statusById.get(a.status_id) : null
                return status && !TERMINAL_CODES.has(status.code)
              }).length}
            />
          </div>
        )}

        {viewMode === 'board' ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3.5 overflow-x-auto bg-muted/30 p-5 pb-[max(env(safe-area-inset-bottom),16px)]">
              {activeStatuses.map((status) => (
                <TintedKanbanColumn
                  key={status.id}
                  status={status}
                  cards={cardsByStageCode.get(status.code) ?? []}
                  isOver={overId === status.id}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                />
              ))}

              <TerminalRail terminals={terminalCounts} overStatusId={overId} />
            </div>

            <DragOverlay>
              {activeApp && (
                <div className="rotate-2 opacity-90">
                  <CrossVacancyCard
                    data={{
                      applicationId: activeApp.id,
                      candidateId: activeApp.candidate_id,
                      firstName: activeApp.first_name,
                      lastName: activeApp.last_name,
                      vacancyTitle: activeApp.vacancy_title,
                      currentPosition: activeApp.current_position,
                      source: activeApp.source,
                      inStageSince:
                        activeApp.last_status_changed_at ?? activeApp.applied_at,
                      appliedAt: activeApp.applied_at,
                      stageCode:
                        (activeApp.status_id && statusById.get(activeApp.status_id)?.code) ??
                        activeStatuses[0]?.code ??
                        'applied',
                      fitScore: activeApp.fit_score,
                    }}
                    selected={false}
                    onToggleSelect={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="bg-muted/30 p-5">
            <ListView
              cards={cardData}
              statuses={statuses}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
            />
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkBar
          selectedCount={selectedIds.size}
          statuses={statuses}
          onMove={handleBulkMove}
          onReject={handleBulkReject}
          onClear={() => {
            setSelectedIds(new Set())
          }}
        />
      )}

      {reviewing && (
        <ReviewMode
          queue={reviewQueue}
          onClose={() => setReviewing(false)}
          onAdvance={handleAdvance}
          onReject={handleReviewReject}
        />
      )}

      {pendingRejection && (
        <RejectionDialog
          open={!!pendingRejection}
          applicationId={pendingRejection.applicationId}
          statusId={pendingRejection.statusId}
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

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (next: ViewMode) => void
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-border bg-muted/30 text-xs"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('board')}
        aria-pressed={viewMode === 'board'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 transition-colors',
          viewMode === 'board'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Board
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={viewMode === 'list'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 transition-colors',
          viewMode === 'list'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <ListIcon className="h-3.5 w-3.5" aria-hidden />
        List
      </button>
    </div>
  )
}


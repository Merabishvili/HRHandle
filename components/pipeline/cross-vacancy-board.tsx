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
import { Layers } from 'lucide-react'

import { KanbanColumn } from './kanban-column'
import { CandidateCard } from './candidate-card'
import {
  RejectionDialog,
  type RejectionReason,
  type RejectionTemplate,
} from './rejection-dialog'
import { RoleFilterDropdown, type RoleOption } from './role-filter-dropdown'
import { TerminalRail } from './terminal-rail'
import { ReviewMode } from './review-mode'
import { Button } from '@/components/ui/button'
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

/**
 * Wave 2.1 — cross-vacancy kanban.
 *
 * Renders all applications across all active vacancies grouped by global
 * stage (Applied → Screening → Interview → Offer). Terminal stages
 * (Hired / Rejected / Withdrawn) collapse into the right-side rail so the
 * working surface stays focused. Forks the per-vacancy KanbanBoard logic
 * for DnD + rejection interception; the only material difference is the
 * data shape (each card knows its vacancy) and the surrounding chrome
 * (role filter dropdown + terminal rail + Review mode toggle).
 *
 * Review mode is the Wave 2.2 keyboard-driven judgement queue, folded into
 * 2.1 per the locked decision. When active it overlays the board with a
 * focused single-candidate view; J/K navigates, A advances, R rejects,
 * Esc exits.
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const activeStatuses = useMemo(
    () => statuses.filter((s) => !TERMINAL_CODES.has(s.code)),
    [statuses],
  )

  const terminalStatuses = useMemo(
    () => statuses.filter((s) => TERMINAL_CODES.has(s.code)),
    [statuses],
  )

  // Filter applications by role first — DnD, columns, and counts all read
  // from this derived set.
  const filteredApplications = useMemo(() => {
    if (roleFilter.length === 0 || roleFilter.length === roles.length) {
      return applications
    }
    const allow = new Set(roleFilter)
    return applications.filter((a) => allow.has(a.vacancy_id))
  }, [applications, roleFilter, roles.length])

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

  // "New" candidates for the Review mode entry — non-terminal applications
  // whose status hasn't been touched since they applied. The default
  // judgement queue.
  const reviewQueue = useMemo(
    () =>
      filteredApplications
        .filter((a) => {
          const status = statuses.find((s) => s.id === a.status_id)
          if (!status || TERMINAL_CODES.has(status.code)) return false
          return !a.last_status_changed_at
        })
        .sort(
          (a, b) =>
            new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime(),
        ),
    [filteredApplications, statuses],
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

    const activeId = String(active.id)
    const overIdStr = String(over.id)

    const isColumn = statuses.some((s) => s.id === overIdStr)
    const targetColumnId = isColumn ? overIdStr : getColumnId(overIdStr)
    if (!targetColumnId) return

    const app = applications.find((a) => a.id === activeId)
    if (!app) return
    if (app.status_id === targetColumnId) return

    const targetStatus = statuses.find((s) => s.id === targetColumnId)

    if (targetStatus?.code === 'rejected') {
      setPendingRejection({
        applicationId: activeId,
        statusId: targetColumnId,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
      return
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.id === activeId
          ? {
              ...a,
              status_id: targetColumnId,
              last_status_changed_at: new Date().toISOString(),
            }
          : a,
      ),
    )

    const result = await updateApplicationStatus(activeId, targetColumnId)
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
      const currentIdx = activeStatuses.findIndex((s) => s.id === app.status_id)
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
    [applications, activeStatuses, initialApplications],
  )

  const handleReviewReject = useCallback(
    (appId: string) => {
      const app = applications.find((a) => a.id === appId)
      const rejectedStatus = statuses.find((s) => s.code === 'rejected')
      if (!app || !rejectedStatus) return
      setPendingRejection({
        applicationId: appId,
        statusId: rejectedStatus.id,
        candidateName: `${app.first_name} ${app.last_name}`.trim(),
      })
    },
    [applications, statuses],
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <RoleFilterDropdown options={roles} value={roleFilter} onChange={setRoleFilter} />
          <p className="text-xs text-muted-foreground">
            {filteredApplications.length} candidate
            {filteredApplications.length === 1 ? '' : 's'} on this board
          </p>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setReviewing(true)}
          disabled={reviewQueue.length === 0}
          aria-label="Enter Review mode"
        >
          <Layers className="h-4 w-4" aria-hidden />
          Review new
          {reviewQueue.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {reviewQueue.length}
            </span>
          )}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
          {activeStatuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              applications={filteredApplications.filter((a) => a.status_id === status.id)}
              isOver={overId === status.id}
            />
          ))}

          <TerminalRail terminals={terminalCounts} overStatusId={overId} />
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
                vacancyTitle={activeApp.vacancy_title}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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

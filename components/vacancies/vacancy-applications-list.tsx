'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Ban, X, ArrowRight, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VacancyApplicationRow } from './vacancy-application-row'
import { BatchRejectionDialog } from './batch-rejection-dialog'
import { BulkMoveDialog } from './bulk-move-dialog'
import type {
  RejectionReason,
  RejectionTemplate,
} from '@/components/pipeline/rejection-dialog'

import type {
  ApplicationStatusOption as AppStatus,
  CandidateStatusOption as GeneralStatus,
} from '@/lib/types/database'
import { APPLICATION_STATUS } from '@/lib/types/constants'

interface Question {
  id: string
  label: string
  type: 'text' | 'score'
}

interface ExistingEvaluation {
  id: string
  score: number | null
  answers: { question_id: string; text_value: string | null; score_value: number | null }[]
}

interface ApplicationItem {
  id: string
  candidateId: string
  candidateName: string
  initials: string
  appliedAt: string
  statusId: string | null
  generalStatus: GeneralStatus | null
  existingEvaluation: ExistingEvaluation | null
}

interface Props {
  applications: ApplicationItem[]
  allStatuses: AppStatus[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  vacancyId: string
  questions: Question[]
}

export function VacancyApplicationsList({
  applications: initial,
  allStatuses,
  rejectionReasons,
  rejectionTemplates,
  vacancyId,
  questions,
}: Props) {
  const router = useRouter()
  const [applications, setApplications] = useState(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [moveTargetStatus, setMoveTargetStatus] = useState<AppStatus | null>(null)

  // Resolve the application_statuses entry for the "rejected" code — needed
  // by the batch action and to grey out already-rejected rows.
  const rejectedStatus = useMemo(
    () => allStatuses.find((s) => s.code === APPLICATION_STATUS.REJECTED),
    [allStatuses],
  )

  // Already-rejected applications are NOT selectable for the bulk action —
  // there's nothing to do. We also exclude the "hired" status for the same
  // reason; rejecting someone you just hired would be a strange path.
  const rejectedId = rejectedStatus?.id
  const hiredStatusId = useMemo(
    () => allStatuses.find((s) => s.code === APPLICATION_STATUS.HIRED)?.id,
    [allStatuses],
  )
  const isSelectableRow = (app: ApplicationItem) =>
    app.statusId !== rejectedId && app.statusId !== hiredStatusId

  const selectableApplications = applications.filter(isSelectableRow)
  const allSelected =
    selectableApplications.length > 0 &&
    selectableApplications.every((a) => selected.has(a.id))

  const toggleAll = (next: boolean) => {
    if (next) {
      setSelected(new Set(selectableApplications.map((a) => a.id)))
    } else {
      setSelected(new Set())
    }
  }

  const toggleOne = (id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }

  const handleBatchSuccess = () => {
    setSelected(new Set())
    // Hard refresh the route so the rows reflect their new status, scoreboards
    // update, and the toolbar disappears.
    router.refresh()
  }

  // Bulk-reject is only meaningful when there's a configured rejected status
  // (otherwise we don't know what to flip the application to).
  const canBatchReject = !!rejectedStatus
  const selectedCount = selected.size

  // Bulk-move targets: every status EXCEPT the dedicated rejection / withdrawn
  // codes (each has its own flow), kept in the platform sort_order. Lazily
  // sorted because allStatuses is small enough that this is cheap.
  const bulkMoveTargets = useMemo(
    () =>
      allStatuses
        .filter(
          (s) =>
            s.code !== APPLICATION_STATUS.REJECTED &&
            s.code !== APPLICATION_STATUS.WITHDRAWN,
        )
        .sort((a, b) => a.sort_order - b.sort_order),
    [allStatuses],
  )

  if (applications.length === 0) return null

  return (
    <>
      {/* Bulk-action toolbar. Shows only when there's something selected, so
          it doesn't add visual noise in the common case. */}
      {canBatchReject && selectedCount > 0 && (
        <div
          className="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
          role="region"
          aria-label="Bulk actions"
        >
          <Checkbox
            checked={allSelected}
            onCheckedChange={(v) => toggleAll(v === true)}
            aria-label={allSelected ? 'Clear selection' : 'Select all visible'}
          />
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  Move to stage
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {bulkMoveTargets.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setMoveTargetStatus(s)}
                  >
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDialogOpen(true)}
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Reject selected
            </Button>
          </div>
        </div>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {applications.map((app) => {
              const selectionDisabled = !isSelectableRow(app)
              return (
                <VacancyApplicationRow
                  key={app.id}
                  applicationId={app.id}
                  candidateId={app.candidateId}
                  candidateName={app.candidateName}
                  initials={app.initials}
                  appliedAt={app.appliedAt}
                  currentStatusId={app.statusId}
                  generalStatus={app.generalStatus}
                  allStatuses={allStatuses}
                  rejectionReasons={rejectionReasons}
                  rejectionTemplates={rejectionTemplates}
                  vacancyId={vacancyId}
                  questions={questions}
                  existingEvaluation={app.existingEvaluation}
                  onRemoved={(id) => {
                    setApplications((prev) => prev.filter((a) => a.id !== id))
                    setSelected((prev) => {
                      if (!prev.has(id)) return prev
                      const copy = new Set(prev)
                      copy.delete(id)
                      return copy
                    })
                  }}
                  selectable={canBatchReject}
                  selected={selected.has(app.id)}
                  onSelectedChange={(next) => toggleOne(app.id, next)}
                  selectionDisabled={selectionDisabled}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {rejectedStatus && (
        <BatchRejectionDialog
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          applicationIds={Array.from(selected)}
          rejectedStatusId={rejectedStatus.id}
          reasons={rejectionReasons}
          templates={rejectionTemplates}
          onSuccess={handleBatchSuccess}
        />
      )}

      <BulkMoveDialog
        open={!!moveTargetStatus}
        onOpenChange={(o) => !o && setMoveTargetStatus(null)}
        applicationIds={Array.from(selected)}
        targetStatus={moveTargetStatus}
        onSuccess={() => {
          setMoveTargetStatus(null)
          handleBatchSuccess()
        }}
      />
    </>
  )
}

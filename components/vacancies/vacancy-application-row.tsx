'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types/candidate'
import { updateApplicationStatus, removeApplication } from '@/lib/actions/applications'

interface AppStatus {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
}

interface GeneralStatus {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
}

interface Props {
  applicationId: string
  candidateId: string
  candidateName: string
  initials: string
  appliedAt: string
  currentStatusId: string | null
  generalStatus: GeneralStatus | null
  allStatuses: AppStatus[]
  onRemoved: (applicationId: string) => void
}

export function VacancyApplicationRow({
  applicationId,
  candidateId,
  candidateName,
  initials,
  appliedAt,
  currentStatusId,
  generalStatus,
  allStatuses,
  onRemoved,
}: Props) {
  const [statusId, setStatusId] = useState<string>(currentStatusId ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentStatus = allStatuses.find((s) => s.id === statusId)

  const handleStatusChange = (newStatusId: string) => {
    if (newStatusId === statusId) return
    setStatusId(newStatusId)
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, newStatusId)
      if (!result.success) setStatusId(currentStatusId ?? '')
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeApplication(applicationId)
      if (result.success) onRemoved(applicationId)
    })
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
        <Link
          href={`/candidates/${candidateId}`}
          className="flex items-center gap-3 min-w-0 flex-1"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xs font-medium text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{candidateName}</p>
            <p className="text-xs text-muted-foreground">
              Applied {formatDistanceToNow(new Date(appliedAt), { addSuffix: true })}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {generalStatus && (
            <Badge
              variant="secondary"
              className={(CANDIDATE_GENERAL_STATUS_COLORS as Record<string, string>)[generalStatus.code]}
            >
              {generalStatus.name}
            </Badge>
          )}

          {/* Status selector */}
          <Select value={statusId} onValueChange={handleStatusChange} disabled={isPending}>
            <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs border-0 bg-transparent focus:ring-0 px-2">
              <SelectValue>
                {currentStatus ? (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(APPLICATION_STATUS_COLORS as Record<string, string>)[currentStatus.code]}`}>
                    {currentStatus.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">No status</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(APPLICATION_STATUS_COLORS as Record<string, string>)[s.code]}`}>
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Remove button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove candidate from vacancy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{candidateName}</strong> from this vacancy. The candidate profile will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

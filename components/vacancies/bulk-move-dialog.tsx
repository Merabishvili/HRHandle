'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowRight } from 'lucide-react'

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

import { moveApplicationsBatch } from '@/lib/actions/applications'
import { partitionByOutcome, summaryToString, type RowResult } from '@/lib/applications/batch'

import type { ApplicationStatusOption as AppStatus } from '@/lib/types/database'

export interface BulkMoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationIds: string[]
  targetStatus: AppStatus | null
  onSuccess?: () => void
}

// Confirmation dialog for bulk-move-to-stage (G-024). The recruiter picks a
// target stage from the toolbar dropdown — that selection is passed in as
// `targetStatus`. Open=false hides the dialog; closing the dialog without
// confirming is a no-op.
export function BulkMoveDialog({
  open,
  onOpenChange,
  applicationIds,
  targetStatus,
  onSuccess,
}: BulkMoveDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const count = applicationIds.length
  const stageLabel = targetStatus?.name ?? 'this stage'

  const handleConfirm = () => {
    if (!targetStatus) return
    startTransition(async () => {
      const result = await moveApplicationsBatch({
        applicationIds,
        targetStatusId: targetStatus.id,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const { moved, skipped, failed, failures } = result.data
      const rows: RowResult[] = [
        ...Array.from({ length: moved }, (_, i) => ({
          applicationId: `m${i}`,
          outcome: 'moved' as const,
        })),
        ...Array.from({ length: skipped }, (_, i) => ({
          applicationId: `s${i}`,
          outcome: 'skipped' as const,
        })),
        ...Array.from({ length: failed }, (_, i) => ({
          applicationId: `f${i}`,
          outcome: 'failed' as const,
        })),
      ]
      const summary = summaryToString(partitionByOutcome(rows), stageLabel)

      if (failures.length > 0) {
        toast.warning(summary, {
          description: failures
            .slice(0, 3)
            .map((f) => `• ${f.error}`)
            .join('\n'),
        })
      } else {
        toast.success(summary)
      }

      onOpenChange(false)
      onSuccess?.()
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Move {count} {count === 1 ? 'application' : 'applications'} to{' '}
            <span className="inline-flex items-center gap-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              {stageLabel}
            </span>
            ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Each application&apos;s status will change, an audit-log entry will be
            written, and (if your org has opted in) a status-change email will be
            sent to the candidate. Rows already at this stage are skipped.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending || !targetStatus}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving…
              </>
            ) : (
              'Move'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

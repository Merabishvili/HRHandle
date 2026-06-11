'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { deleteCandidate, getCandidateDeleteImpact } from '@/lib/actions/candidates'

export interface DeleteCandidateDialogProps {
  candidateId: string
  candidateName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where to send the user after a successful delete. The status-actions
   * dropdown uses `router.refresh()`; the detail-page button uses
   * `/candidates`. Defaults to refresh-in-place when omitted. */
  onDeleted?: () => void
}

export function DeleteCandidateDialog({
  candidateId,
  candidateName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCandidateDialogProps) {
  const router = useRouter()
  const [impactLoading, setImpactLoading] = useState(false)
  const [activeApplicationCount, setActiveApplicationCount] = useState<number | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Load the application count whenever the dialog is opened. Keeps the count
  // fresh if the recruiter dismissed once, did something else, and re-opened.
  useEffect(() => {
    if (!open) {
      setActiveApplicationCount(null)
      return
    }
    let cancelled = false
    setImpactLoading(true)
    getCandidateDeleteImpact(candidateId).then((result) => {
      if (cancelled) return
      if (result.success) {
        setActiveApplicationCount(result.data.activeApplicationCount)
      } else {
        // Non-fatal: show the dialog without a count rather than blocking.
        setActiveApplicationCount(null)
      }
      setImpactLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, candidateId])

  const handleConfirm = async () => {
    setIsPending(true)
    const result = await deleteCandidate(candidateId)
    if (result.success) {
      toast.success(`Candidate "${candidateName}" deleted.`)
      onOpenChange(false)
      if (onDeleted) {
        onDeleted()
      } else {
        router.refresh()
      }
    } else {
      toast.error(result.error)
      setIsPending(false)
    }
  }

  const renderImpactCopy = () => {
    if (impactLoading || activeApplicationCount === null) {
      return (
        <>
          <strong>{candidateName}</strong> and any active applications they have will be
          removed. Evaluation history and documents are kept until the 30-day grace
          period expires, after which everything is permanently deleted. An admin can
          restore the candidate before then.
        </>
      )
    }
    if (activeApplicationCount === 0) {
      return (
        <>
          <strong>{candidateName}</strong> will be removed. Documents and history are
          kept until the 30-day grace period expires, after which everything is
          permanently deleted. An admin can restore the candidate before then.
        </>
      )
    }
    const noun = activeApplicationCount === 1 ? 'active application' : 'active applications'
    return (
      <>
        <strong>{candidateName}</strong> and their <strong>{activeApplicationCount} {noun}</strong>{' '}
        will be removed. Evaluation history and documents are kept until the 30-day
        grace period expires, after which everything is permanently deleted. An admin
        can restore the candidate before then.
      </>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
          <AlertDialogDescription>
            {impactLoading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking active applications…
              </span>
            ) : (
              renderImpactCopy()
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending || impactLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete candidate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

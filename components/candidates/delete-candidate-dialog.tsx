'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
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
      toast.success(t('delCand.toastDeleted', { name: candidateName }))
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
    const bold = { b: (c: React.ReactNode) => <strong>{c}</strong> }
    if (impactLoading || activeApplicationCount === null) {
      return t.rich('delCand.impactUnknown', { name: candidateName, ...bold })
    }
    if (activeApplicationCount === 0) {
      return t.rich('delCand.impactZero', { name: candidateName, ...bold })
    }
    return t.rich('delCand.impactCount', {
      name: candidateName,
      count: activeApplicationCount,
      ...bold,
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delCand.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {impactLoading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('delCand.checking')}
              </span>
            ) : (
              renderImpactCopy()
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending || impactLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? t('offer.deleting') : t('candidates.deleteCandidate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

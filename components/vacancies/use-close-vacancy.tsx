'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { CloseVacancyDialog } from '@/components/vacancies/close-vacancy-dialog'
import { getRemainingSummary, type RemainingSummary } from '@/lib/actions/applications'
import { updateVacancyStatus } from '@/lib/actions/vacancies'

export interface CloseRequest {
  vacancyId: string
  /** The Closed or Archived vacancy status id. */
  statusId: string
  action: 'close' | 'archive'
  /** Called once the question is settled: true if the status changed. */
  onDone?: (changed: boolean) => void
}

/**
 * Closing or archiving a vacancy. With candidates still in progress, owners/
 * admins are asked first ("Close only" / "Close and reject"); otherwise — and
 * for members, who can't reject in bulk — the status just changes. Render the
 * returned `closeDialog` once next to whatever calls `requestClose`.
 */
export function useCloseVacancy({ onRejectNext }: { onRejectNext: (vacancyId: string) => void }) {
  const router = useRouter()
  const t = useTranslations()
  const [asking, setAsking] = useState<{ request: CloseRequest; summary: RemainingSummary } | null>(null)
  const [pending, setPending] = useState(false)
  const settled = useRef(false)

  const changeStatus = async (request: CloseRequest): Promise<boolean> => {
    const result = await updateVacancyStatus(request.vacancyId, request.statusId)
    if (!result.success) {
      toast.error(t('closeVacancy.failed'))
      return false
    }
    router.refresh()
    return true
  }

  const requestClose = async (request: CloseRequest) => {
    const summary = await getRemainingSummary(request.vacancyId)
    if (!summary || summary.total === 0) {
      request.onDone?.(await changeStatus(request))
      return
    }
    settled.current = false
    setAsking({ request, summary })
  }

  const finish = (changed: boolean) => {
    if (!asking || settled.current) return
    settled.current = true
    asking.request.onDone?.(changed)
    setAsking(null)
  }

  const closeDialog = asking ? (
    <CloseVacancyDialog
      open
      onOpenChange={(open) => {
        if (!open) finish(false)
      }}
      action={asking.request.action}
      summary={asking.summary}
      pending={pending}
      onConfirm={async (thenReject) => {
        setPending(true)
        const changed = await changeStatus(asking.request)
        setPending(false)
        const vacancyId = asking.request.vacancyId
        finish(changed)
        if (changed && thenReject) onRejectNext(vacancyId)
      }}
    />
  ) : null

  return { requestClose, closeDialog }
}

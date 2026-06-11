'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Edit,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

import { OfferForm, type OfferFormInitial } from '@/components/offers/offer-form'
import {
  sendOffer,
  withdrawOffer,
  deleteOffer,
} from '@/lib/actions/offers'
import {
  type OfferStatus,
  type CompensationPeriod,
  COMPENSATION_PERIOD_LABELS,
} from '@/lib/offers/state'

export interface OfferRow {
  id: string
  status: OfferStatus
  role_title: string
  compensation_amount: number | null
  compensation_currency: string | null
  compensation_period: CompensationPeriod | null
  start_date: string | null
  expiry_date: string | null
  body: string
  recruiter_message: string | null
  public_token: string | null
  sent_at: string | null
  responded_at: string | null
  decline_reason: string | null
}

interface OfferPanelProps {
  applicationId: string
  vacancyTitle: string
  /** All non-soft-deleted offers attached to this application, newest first.
   * Active (draft/sent) offers render with action buttons; terminal offers
   * (accepted/declined/expired/withdrawn) are listed as a short history. */
  offers: OfferRow[]
  canEdit: boolean
}

const STATUS_STYLE: Record<OfferStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-amber-100 text-amber-900' },
  sent: { label: 'Sent', className: 'bg-indigo-100 text-indigo-900' },
  accepted: { label: 'Accepted', className: 'bg-emerald-100 text-emerald-900' },
  declined: { label: 'Declined', className: 'bg-rose-100 text-rose-900' },
  expired: { label: 'Expired', className: 'bg-gray-200 text-gray-700' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-200 text-gray-700' },
}

export function OfferPanel({
  applicationId,
  vacancyTitle,
  offers,
  canEdit,
}: OfferPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OfferRow | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const active = useMemo(
    () => offers.find((o) => o.status === 'draft' || o.status === 'sent') ?? null,
    [offers],
  )
  const history = useMemo(
    () => offers.filter((o) => o !== active),
    [offers, active],
  )

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (row: OfferRow) => {
    setEditing(row)
    setOpen(true)
  }

  const handleSend = (offerId: string) => {
    startTransition(async () => {
      const result = await sendOffer(offerId)
      if (result.success) {
        toast.success('Offer sent to candidate.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const confirmWithdraw = () => {
    if (!withdrawingId) return
    const id = withdrawingId
    startTransition(async () => {
      const result = await withdrawOffer(id)
      if (result.success) {
        toast.success('Offer withdrawn.')
        setWithdrawingId(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const confirmDelete = () => {
    if (!deletingId) return
    const id = deletingId
    startTransition(async () => {
      const result = await deleteOffer(id)
      if (result.success) {
        toast.success('Draft deleted.')
        setDeletingId(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const copyToken = async (token: string, offerId: string) => {
    const url = `${window.location.origin}/offer/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedFor(offerId)
      setTimeout(() => setCopiedFor((c) => (c === offerId ? null : c)), 1500)
    } catch (err) {
      console.error('[offer-panel] clipboard failed:', err)
      toast.error('Could not copy link.')
    }
  }

  const formInitial: OfferFormInitial = editing
    ? {
        id: editing.id,
        role_title: editing.role_title,
        body: editing.body,
        recruiter_message: editing.recruiter_message,
        compensation_amount: editing.compensation_amount,
        compensation_currency: editing.compensation_currency,
        compensation_period: editing.compensation_period,
        start_date: editing.start_date,
        expiry_date: editing.expiry_date,
      }
    : {
        id: null,
        role_title: '',
        body: '',
        recruiter_message: null,
        compensation_amount: null,
        compensation_currency: null,
        compensation_period: null,
        start_date: null,
        expiry_date: null,
      }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Offer</span>
        {canEdit && !active && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create offer
          </Button>
        )}
      </div>

      {!active && offers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No offer for this application yet.
          {canEdit ? ' Click Create offer to draft one.' : ''}
        </p>
      )}

      {active && (
        <ActiveOfferCard
          offer={active}
          canEdit={canEdit}
          isPending={isPending}
          onEdit={() => openEdit(active)}
          onSend={() => handleSend(active.id)}
          onWithdraw={() => setWithdrawingId(active.id)}
          onDelete={() => setDeletingId(active.id)}
          onCopyLink={() => active.public_token && copyToken(active.public_token, active.id)}
          copied={copiedFor === active.id}
        />
      )}

      {history.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronRight className="mr-1 inline h-3 w-3" aria-hidden />
            Previous offers ({history.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {history.map((o) => {
              const style = STATUS_STYLE[o.status]
              const at = o.responded_at ?? o.sent_at
              return (
                <li key={o.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                  <Badge variant="secondary" className={style.className}>
                    {style.label}
                  </Badge>
                  <span className="text-muted-foreground">{o.role_title}</span>
                  <span className="ml-auto text-muted-foreground">
                    {at ? format(new Date(at), 'MMM d, yyyy') : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {canEdit && (
        <OfferForm
          applicationId={applicationId}
          open={open}
          onOpenChange={setOpen}
          initial={formInitial}
          fallbackRoleTitle={vacancyTitle}
        />
      )}

      <AlertDialog open={!!withdrawingId} onOpenChange={(o) => !o && setWithdrawingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              The candidate&apos;s offer page will show that the offer has been withdrawn.
              You can create a new offer afterwards if you want to revise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmWithdraw}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Withdrawing…' : 'Withdraw offer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft entirely. Only drafts can be deleted — sent offers
              stay as part of the candidate&apos;s history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting…' : 'Delete draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface ActiveOfferCardProps {
  offer: OfferRow
  canEdit: boolean
  isPending: boolean
  onEdit: () => void
  onSend: () => void
  onWithdraw: () => void
  onDelete: () => void
  onCopyLink: () => void
  copied: boolean
}

function ActiveOfferCard({
  offer,
  canEdit,
  isPending,
  onEdit,
  onSend,
  onWithdraw,
  onDelete,
  onCopyLink,
  copied,
}: ActiveOfferCardProps) {
  const style = STATUS_STYLE[offer.status]
  const showDraftActions = offer.status === 'draft'
  const showSentActions = offer.status === 'sent'

  const compensationLine =
    offer.compensation_amount !== null && offer.compensation_amount !== undefined
      ? formatComp(offer.compensation_amount, offer.compensation_currency, offer.compensation_period)
      : null

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className={style.className}>
          {style.label}
        </Badge>
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground">{offer.role_title}</p>
          {compensationLine && (
            <p className="text-xs text-muted-foreground">{compensationLine}</p>
          )}
        </div>
      </div>

      {(offer.start_date || offer.expiry_date) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {offer.start_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Start {format(new Date(offer.start_date), 'MMM d, yyyy')}
            </span>
          )}
          {offer.expiry_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Respond by {format(new Date(offer.expiry_date), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {showDraftActions && (
            <>
              <Button type="button" size="sm" onClick={onSend} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                Send to candidate
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={isPending}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete draft
              </Button>
            </>
          )}
          {showSentActions && (
            <>
              {offer.public_token && (
                <Button type="button" size="sm" variant="outline" onClick={onCopyLink}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy offer link
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={onWithdraw}
                disabled={isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Withdraw
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function formatComp(
  amount: number,
  currency: string | null,
  period: CompensationPeriod | null,
): string {
  let formatted = String(amount)
  if (currency) {
    try {
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      formatted = `${amount.toLocaleString('en-US')} ${currency}`
    }
  } else {
    formatted = amount.toLocaleString('en-US')
  }
  const periodLabel = period ? COMPENSATION_PERIOD_LABELS[period] : ''
  return periodLabel ? `${formatted} ${periodLabel}` : formatted
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, X, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { acceptOfferByToken, declineOfferByToken } from '@/lib/actions/offers'

interface OfferRespondFormProps {
  token: string
}

/**
 * Candidate-facing accept / decline UI for the public offer page.
 *
 * Wave 3.3 changes:
 *  - Accept goes through a proper AlertDialog instead of the previous
 *    `window.confirm()` call — same one-shot UX but stylable and visible
 *    on every platform consistently.
 *  - Decline opens a confirm-decline AlertDialog containing the optional
 *    reason textarea. The reason is captured locally and posted to
 *    `declineOfferByToken(token, reason)` only when the candidate hits
 *    the destructive action button inside the dialog. Cancelling closes
 *    the dialog without touching state.
 *  - `decline_reason` is now persisted (already exposed by the action) —
 *    no UI thread continues without it.
 */
export function OfferRespondForm({ token }: OfferRespondFormProps) {
  const router = useRouter()
  const t = useTranslations()
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAcceptConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await acceptOfferByToken(token)
      if (result.success) {
        setAcceptOpen(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  const handleDeclineConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await declineOfferByToken(token, reason.trim() || null)
      if (result.success) {
        setDeclineOpen(false)
        setReason('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* A-10 — Action bar sticks to the bottom of the viewport on
          mobile so Accept / Decline stays in thumb-reach even when the
          offer body is long. Renders inline on sm+. The safe-area
          inset keeps it clear of the iOS home indicator; the white/
          blur backdrop + top border distinguish it from the offer
          text behind. Decline appears first per the design
          (`Public Offer.dc.html`): trailing slot is the primary
          action. */}
      <div
        className="sticky bottom-0 z-10 -mx-4 flex flex-row gap-2 border-t border-gray-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:relative sm:-mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null)
            setDeclineOpen(true)
          }}
          disabled={isPending}
          className="flex-1"
        >
          <X className="mr-2 h-4 w-4" aria-hidden />
          {t('offer.decline')}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setError(null)
            setAcceptOpen(true)
          }}
          disabled={isPending}
          // Brand-blue per Public Offer.dc.html — accepting a job offer is a
          // brand moment, not a destructive/safety one (the design notes amber
          // would read alarming). Tier 1 of fidelity-audit.md.
          className="flex-1 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
        >
          <Check className="mr-2 h-4 w-4" aria-hidden />
          {t('offer.acceptOffer')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AlertDialog
        open={acceptOpen}
        onOpenChange={(open) => !isPending && setAcceptOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('offer.acceptTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('offer.acceptDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptConfirm}
              disabled={isPending}
              className="bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t('offer.accepting')}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                  {t('offer.acceptOffer')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={declineOpen}
        onOpenChange={(open) => {
          if (isPending) return
          setDeclineOpen(open)
          if (!open) setReason('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('offer.declineTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('offer.declineDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="decline-reason"
              className="text-sm font-medium text-gray-900"
            >
              {t('offer.declineReasonLabel')}
            </label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('offer.declineReasonPlaceholder')}
              rows={4}
              maxLength={1000}
              disabled={isPending}
              className="text-sm"
            />
          </div>

          <AlertDialogFooter>
            {/* "Go back" per Public Offer.dc.html — softer copy than the
                default "Cancel", makes the decision moment less stark on a
                destructive irreversible action. Tier 2 of fidelity-audit.md. */}
            <AlertDialogCancel disabled={isPending}>{t('offer.goBack')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t('offer.declining')}
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" aria-hidden />
                  {t('offer.confirmDecline')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

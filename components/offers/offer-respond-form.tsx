'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
      <div className="flex flex-col gap-2 sm:flex-row">
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
          Accept offer
        </Button>
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
          Decline
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
            <AlertDialogTitle>Accept this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              The recruiter will be notified you accepted and will be in touch
              with the next steps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptConfirm}
              disabled={isPending}
              className="bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Accepting…
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                  Accept offer
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
            <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              The recruiter will be notified. You can leave a short reason if
              you&apos;d like — only they will see it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="decline-reason"
              className="text-sm font-medium text-gray-900"
            >
              Reason for declining (optional)
            </label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Took a different offer. Compensation was lower than expected. Timing isn't right."
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
            <AlertDialogCancel disabled={isPending}>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Declining…
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" aria-hidden />
                  Confirm decline
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

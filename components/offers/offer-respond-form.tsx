'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { acceptOfferByToken, declineOfferByToken } from '@/lib/actions/offers'

type Mode = 'idle' | 'declining'

interface OfferRespondFormProps {
  token: string
}

export function OfferRespondForm({ token }: OfferRespondFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('idle')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAccept = () => {
    setError(null)
    if (!confirm('Accept this offer? This will let the recruiter know you have accepted.')) return
    startTransition(async () => {
      const result = await acceptOfferByToken(token)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  const handleDecline = () => {
    setError(null)
    startTransition(async () => {
      const result = await declineOfferByToken(token, reason.trim() || null)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (mode === 'declining') {
    return (
      <div className="space-y-3">
        <label htmlFor="decline-reason" className="text-sm font-medium text-gray-900">
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
        <p className="text-xs text-gray-500">
          Optional, kept private — only the recruiter who sent the offer sees this.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setReason('')
              setError(null)
              setMode('idle')
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDecline}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining…
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Confirm decline
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Working…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Accept offer
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setMode('declining')}
          disabled={isPending}
          className="flex-1"
        >
          <X className="mr-2 h-4 w-4" />
          Decline
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

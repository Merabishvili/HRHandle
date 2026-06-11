'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'

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

import { withdrawApplicationByToken } from '@/lib/actions/applications'

interface WithdrawButtonProps {
  token: string
  roleTitle: string
  organizationName: string
}

// Rendered on /status/<token> when the application is still in a non-terminal
// state. Two-step confirm (button → AlertDialog with optional reason) so a
// candidate doesn't accidentally close their own application.
export function WithdrawButton({
  token,
  roleTitle,
  organizationName,
}: WithdrawButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await withdrawApplicationByToken(token, reason.trim() || null)
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-xs text-gray-500">
          Not interested anymore? You can withdraw your application below.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-700 hover:bg-gray-100"
          onClick={() => setOpen(true)}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Withdraw application
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re about to withdraw your application for{' '}
              <strong>{roleTitle}</strong> at{' '}
              <strong>{organizationName}</strong>. The recruiter will be notified
              and this cannot be undone from this page.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor="withdraw-reason" className="text-sm font-medium text-gray-900">
              Reason (optional)
            </label>
            <Textarea
              id="withdraw-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Took a different role. Timing isn't right."
              rows={3}
              maxLength={1000}
              disabled={isPending}
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Only the recruiter who hired for this role sees this message.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Withdrawing…
                </>
              ) : (
                'Confirm withdraw'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

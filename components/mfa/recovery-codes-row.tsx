'use client'

import { useState, useTransition } from 'react'
import { Lock, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { regenerateMyRecoveryCodes } from '@/lib/actions/mfa-recovery-codes'
import { RECOVERY_CODE_COUNT } from '@/lib/mfa/recovery-codes'
import { RevealRecoveryCodesDialog } from './reveal-recovery-codes-dialog'

interface Props {
  initialRemaining: number
}

/**
 * A-8b — Recovery-codes row that lives inside the MFA card. Shows
 * "N of 10 remaining" and a Regenerate button that triggers the
 * reveal-once flow. The Regenerate button opens an AlertDialog
 * because regenerating invalidates the existing set.
 */
export function RecoveryCodesRow({ initialRemaining }: Props) {
  const [remaining, setRemaining] = useState(initialRemaining)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revealCodes, setRevealCodes] = useState<string[] | null>(null)
  const [pending, startTransition] = useTransition()

  const handleRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateMyRecoveryCodes()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRemaining(result.data.codes.length)
      setRevealCodes(result.data.codes)
      setConfirmOpen(false)
    })
  }

  const hasCodes = remaining > 0

  return (
    <>
      <div className="flex items-center gap-3 rounded-[9px] border border-[oklch(0.92_0.01_250)] px-[13px] py-[11px]">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">Recovery codes</p>
          <p className="text-[11px] text-muted-foreground">
            {hasCodes
              ? `${remaining} of ${RECOVERY_CODE_COUNT} remaining`
              : 'No recovery codes generated yet'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className="h-7 gap-1.5 px-2 text-xs font-semibold text-primary hover:text-primary"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden />
          )}
          {hasCodes ? 'Regenerate' : 'Generate'}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !pending && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasCodes ? 'Regenerate recovery codes?' : 'Generate recovery codes?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasCodes
                ? `Your existing ${RECOVERY_CODE_COUNT} codes will be invalidated and a new set will be shown — once. Save them somewhere safe before closing the dialog.`
                : `${RECOVERY_CODE_COUNT} one-time codes will be created and shown — once. Save them somewhere safe before closing the dialog.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRegenerate()
              }}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Generating…
                </>
              ) : (
                hasCodes ? 'Regenerate' : 'Generate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RevealRecoveryCodesDialog
        codes={revealCodes}
        onClose={() => setRevealCodes(null)}
      />
    </>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
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
          <p className="text-[12.5px] font-semibold text-foreground">{t('mfa.recoveryCodes')}</p>
          <p className="text-[11px] text-muted-foreground">
            {hasCodes
              ? t('mfa.remaining', { remaining, total: RECOVERY_CODE_COUNT })
              : t('mfa.noCodesYet')}
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
          {hasCodes ? t('mfa.regenerate') : t('mfa.generate')}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !pending && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasCodes ? t('mfa.regenerateTitle') : t('mfa.generateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasCodes
                ? t('mfa.regenerateDesc', { total: RECOVERY_CODE_COUNT })
                : t('mfa.generateDesc', { total: RECOVERY_CODE_COUNT })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
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
                  {t('mfa.generating')}
                </>
              ) : (
                hasCodes ? t('mfa.regenerate') : t('mfa.generate')
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

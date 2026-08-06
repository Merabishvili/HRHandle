'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Download, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface Props {
  codes: string[] | null
  onClose: () => void
}

/**
 * A-8b — Reveal-once modal for newly generated recovery codes.
 *
 * Per the design's "saved them" lock: the close affordance requires
 * the user to tick "I've saved these codes" first. This is the only
 * time the raw codes will ever be visible — closing without copying
 * means the user will need to regenerate.
 */
export function RevealRecoveryCodesDialog({ codes, onClose }: Props) {
  const t = useTranslations()
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const open = codes !== null

  const handleCopy = async () => {
    if (!codes) return
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      toast.success(t('mfa.codesCopied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('mfa.copyFailed'))
    }
  }

  const handleDownload = () => {
    if (!codes) return
    const blob = new Blob([
      'HRHandle MFA recovery codes\nGenerated ' + new Date().toISOString() + '\n\n' + codes.join('\n') + '\n',
    ], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hrhandle-recovery-codes.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && confirmed) {
      setConfirmed(false)
      setCopied(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            {t('mfa.yourRecoveryCodes')}
          </DialogTitle>
          <DialogDescription>
            {t('mfa.revealDesc')}
          </DialogDescription>
        </DialogHeader>

        {codes && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {codes.map((c) => (
                <li key={c} className="select-all">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1 gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> {t('common.copied')}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden /> {t('mfa.copyAll')}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex-1 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> {t('mfa.download')}
          </Button>
        </div>

        <label className="flex items-center gap-2 pt-1 text-sm">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
          />
          {t('mfa.savedConfirm')}
        </label>

        <Button
          type="button"
          disabled={!confirmed}
          onClick={() => {
            setConfirmed(false)
            setCopied(false)
            onClose()
          }}
          className="w-full"
        >
          {t('common.close')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

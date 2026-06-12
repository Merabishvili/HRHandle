'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { startEnrollment, verifyEnrollment } from '@/lib/actions/mfa'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnrolled: () => void
}

export function EnrollTotpDialog({ open, onOpenChange, onEnrolled }: Props) {
  const [enrollment, setEnrollment] = useState<{
    factorId: string
    qrCodeSvg: string
    secret: string
  } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && !enrollment) {
      startTransition(async () => {
        const res = await startEnrollment()
        if (res.success) {
          setEnrollment({
            factorId: res.data.factorId,
            qrCodeSvg: res.data.qrCodeSvg,
            secret: res.data.secret,
          })
        } else {
          setError(res.error)
        }
      })
    }
    if (!open) {
      setEnrollment(null)
      setCode('')
      setError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function onVerify() {
    if (!enrollment) return
    startTransition(async () => {
      const res = await verifyEnrollment(enrollment.factorId, code)
      if (res.success) {
        onEnrolled()
        onOpenChange(false)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up an authenticator</DialogTitle>
          <DialogDescription>
            Scan the QR code with Google Authenticator, 1Password, Authy, or any TOTP app. Then enter the 6-digit code it shows.
          </DialogDescription>
        </DialogHeader>

        {!enrollment && isPending && (
          <p className="text-sm text-muted-foreground">Generating QR code…</p>
        )}

        {enrollment && (
          <div className="space-y-4">
            <div
              className="mx-auto h-48 w-48 rounded-md border bg-white p-2"
              dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
            />
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Can&apos;t scan? Enter this key manually</summary>
              <p className="mt-2 break-all rounded bg-muted p-2 font-mono">{enrollment.secret}</p>
            </details>

            <div className="space-y-2">
              <Label htmlFor="totp-code">6-digit code from your app</Label>
              <Input
                id="totp-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onVerify} disabled={isPending || !enrollment || code.length < 6}>
            {isPending ? 'Verifying…' : 'Verify and enable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

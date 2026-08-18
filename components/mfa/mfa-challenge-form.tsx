'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  startLoginChallenge,
  completeLoginChallenge,
} from '@/lib/actions/mfa'

interface Props {
  next: string
}

export function MfaChallengeForm({ next }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [challenge, setChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const res = await startLoginChallenge()
      if (res.success) setChallenge(res.data)
      else setError(res.error)
    })
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!challenge) return
    startTransition(async () => {
      const res = await completeLoginChallenge(challenge.factorId, challenge.challengeId, code)
      if (res.success) {
        router.replace(next)
      } else {
        setError(res.error)
        // Issue a fresh challenge so the user can try again with a new code.
        const fresh = await startLoginChallenge()
        if (fresh.success) setChallenge(fresh.data)
      }
    })
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="mfa-code">{t('mfa.sixDigitCode')}</Label>
        <Input
          id="mfa-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isPending || !challenge || code.length < 6}>
        {isPending ? t('mfa.verifying') : t('mfa.verify')}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t('mfa.lostAccess')}
      </p>
    </form>
  )
}

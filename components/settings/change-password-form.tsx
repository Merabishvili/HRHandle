'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { createClient } from '@/lib/supabase/client'
import { verifyPassword } from '@/lib/actions/auth'
import { authErrorMessage } from '@/lib/auth/error-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface ChangePasswordFormProps {
  userEmail: string
  isOAuthOnly: boolean
}

export function ChangePasswordForm({ userEmail, isOAuthOnly }: ChangePasswordFormProps) {
  const t = useTranslations()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // Verifying the current password re-authenticates via signInWithPassword,
  // which Supabase's CAPTCHA protection guards — so we need a Turnstile token
  // here too, or the re-auth is rejected and looks like a wrong password (#18).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  // If the account has MFA enabled but the current session is only AAL1,
  // Supabase refuses updateUser until the second factor is proven. We then flip
  // into this mode and ask for a TOTP code (#18).
  const [mfaMode, setMfaMode] = useState(false)
  const [mfaCode, setMfaCode] = useState('')

  if (isOAuthOnly) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('changePw.oauthOnly')}
      </p>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Client-side validation — do all checks before any network call
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('changePw.allRequired'))
      return
    }

    if (newPassword.length < 8) {
      setError(t('changePw.minLength'))
      return
    }

    if (newPassword === currentPassword) {
      setError(t('changePw.mustDiffer'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePw.noMatch'))
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Verify the current password on a STATELESS server client so it
      // doesn't downgrade this (possibly AAL2/MFA) session — see verifyPassword.
      // The captcha token is forwarded because Supabase guards signInWithPassword.
      const verify = await verifyPassword(userEmail, currentPassword, captchaToken)

      // Turnstile tokens are single-use — refresh the widget so a retry (e.g.
      // after a genuine typo) has a fresh token instead of a spent one.
      turnstileRef.current?.reset()
      setCaptchaToken(null)

      if (!verify.success) {
        setError(verify.reason === 'captcha' ? t('auth.errCaptcha') : t('changePw.wrongCurrent'))
        setIsLoading(false)
        return
      }

      // Step 2: Update the password. If the session is AAL1 with MFA enabled,
      // switch to the TOTP step instead of erroring.
      const res = await applyNewPassword()
      if (res === 'ok') {
        finishSuccess()
        return
      }
      if (res === 'mfa') {
        // Not an error — the next step. Neutral prompt renders in the MFA form.
        setMfaMode(true)
        setError(null)
        setIsLoading(false)
        return
      }
      setError(res)
      setIsLoading(false)
    } catch {
      setError(t('changePw.genericError'))
      setIsLoading(false)
    }
  }

  // Apply the new password on the current session. Returns 'mfa' when Supabase
  // requires the second factor first (AAL2).
  const applyNewPassword = async (): Promise<'ok' | 'mfa' | string> => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) return 'ok'
    const needsMfa =
      error.code === 'insufficient_aal' ||
      /aal2|assurance level|mfa is enabled/i.test(error.message)
    if (needsMfa) return 'mfa'
    return authErrorMessage(t, error, 'changePw.genericError')
  }

  const finishSuccess = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setMfaMode(false)
    setMfaCode('')
    setSuccess(true)
    setIsLoading(false)
  }

  // MFA step: verify the TOTP code on this client to reach AAL2, then apply the
  // (already-entered) new password.
  const handleMfaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = (factors?.totp ?? []).find((f) => f.status === 'verified')
    if (!factor) {
      setError(t('changePw.genericError'))
      setIsLoading(false)
      return
    }
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (chErr || !challenge) {
      setError(t('changePw.genericError'))
      setIsLoading(false)
      return
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: mfaCode,
    })
    if (verifyErr) {
      setError(t('auth.errMfaCode'))
      setMfaCode('')
      setIsLoading(false)
      return
    }

    const res = await applyNewPassword()
    if (res === 'ok') {
      finishSuccess()
      return
    }
    setError(res === 'mfa' ? t('auth.errMfaRequired') : res)
    setIsLoading(false)
  }

  if (mfaMode) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('auth.errMfaRequired')}</p>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-code">{t('auth.mfaCodeLabel')}</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            disabled={isLoading}
          />
        </div>

        <Button type="submit" disabled={isLoading || mfaCode.length < 6}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('changePw.updating')}
            </>
          ) : (
            t('changePw.updatePassword')
          )}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {t('changePw.success')}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="current-password">{t('changePw.currentPassword')}</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">{t('changePw.newPassword')}</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          disabled={isLoading}
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">{t('changePw.min8')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t('changePw.confirmPassword')}</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          disabled={isLoading}
          minLength={8}
        />
      </div>

      <Button type="submit" disabled={isLoading || !captchaToken || !currentPassword || !newPassword || !confirmPassword}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('changePw.updating')}
          </>
        ) : (
          t('changePw.updatePassword')
        )}
      </Button>

      <Turnstile
        ref={turnstileRef}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onSuccess={(token) => setCaptchaToken(token)}
        onError={() => setCaptchaToken(null)}
        onExpire={() => setCaptchaToken(null)}
        options={{ size: 'invisible' }}
      />
    </form>
  )
}

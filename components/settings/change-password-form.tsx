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

      // Step 2: Update to the new password on the real (AAL2-intact) session.
      // Supabase automatically invalidates all other active sessions on password change.
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(authErrorMessage(t, updateError, 'changePw.genericError'))
        setIsLoading(false)
        return
      }

      // Clear fields and show success
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch {
      setError(t('changePw.genericError'))
    } finally {
      setIsLoading(false)
    }
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

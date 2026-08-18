'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
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
      const supabase = createClient()

      // Step 1: Verify the current password by re-authenticating.
      // This is critical — prevents an attacker with an active session from
      // changing the password without knowing the current one.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      })

      if (verifyError) {
        setError(t('changePw.wrongCurrent'))
        setIsLoading(false)
        return
      }

      // Step 2: Update to the new password.
      // Supabase automatically invalidates all other active sessions on password change.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(updateError.message)
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

      <Button type="submit" disabled={isLoading}>
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

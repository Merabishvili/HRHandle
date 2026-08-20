'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth/error-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Briefcase, Loader2, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const t = useTranslations()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // When the account has MFA enabled, the recovery session is only AAL1 and
  // Supabase refuses the password update until the user proves the second factor
  // (#13a). We flip into this mode on that error and ask for a TOTP code.
  const [mfaMode, setMfaMode] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const router = useRouter()

  // Update the password on the (client) recovery session. Returns 'mfa' when
  // Supabase requires a second factor first.
  const applyNewPassword = async (): Promise<'ok' | 'mfa' | string> => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) return 'ok'
    const needsMfa =
      error.code === 'insufficient_aal' ||
      /aal2|assurance level|mfa is enabled/i.test(error.message)
    if (needsMfa) return 'mfa'
    return authErrorMessage(t, error, 'auth.errResetFailed')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('auth.errPasswordMin'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.errPasswordsNoMatch'))
      return
    }

    setIsLoading(true)
    const res = await applyNewPassword()
    if (res === 'ok') {
      router.push('/auth/reset-password-success')
      router.refresh()
      return
    }
    if (res === 'mfa') {
      setMfaMode(true)
      setError(t('auth.errMfaRequired'))
      setIsLoading(false)
      return
    }
    setError(res)
    setIsLoading(false)
  }

  // Second step for MFA accounts: verify the TOTP code to elevate the recovery
  // session to AAL2, then apply the (already-entered) new password. The whole
  // challenge runs on the SAME browser client so its in-memory session becomes
  // AAL2 before updateUser (a server-action challenge would only elevate the
  // server-side session, leaving this client on AAL1).
  const handleMfaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = (factors?.totp ?? []).find((f) => f.status === 'verified')
    if (!factor) {
      setError(t('auth.errResetFailed'))
      setIsLoading(false)
      return
    }

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (chErr || !challenge) {
      setError(t('auth.errResetFailed'))
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

    // Session is now AAL2 on this client — apply the new password.
    const res = await applyNewPassword()
    if (res === 'ok') {
      router.push('/auth/reset-password-success')
      router.refresh()
      return
    }
    setError(res === 'mfa' ? t('auth.errMfaRequired') : res)
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">HRHandle</span>
          </Link>
        </div>

        <Card className="border-border">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t('auth.resetTitle')}</CardTitle>
            <CardDescription>{t('auth.resetSubtitle')}</CardDescription>
          </CardHeader>

          <CardContent>
            {mfaMode ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mfaCode">{t('auth.mfaCodeLabel')}</Label>
                  <Input
                    id="mfaCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || mfaCode.length < 6}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.updating')}
                    </>
                  ) : (
                    t('auth.updatePassword')
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.newPassword')}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmNewPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || password.length < 8 || password !== confirmPassword}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.updating')}
                    </>
                  ) : (
                    t('auth.updatePassword')
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
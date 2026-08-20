'use client'

import { Suspense, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/auth/error-i18n'
import { setSessionPreference } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Briefcase, Loader2 } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

function LoginForm() {
  const t = useTranslations()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false)
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState<boolean>(false)
  const [rememberMe, setRememberMe] = useState<boolean>(true)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawNext = searchParams.get('next') ?? ''
  const safeNext = rawNext.startsWith('/') ? rawNext : '/pipeline'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!captchaToken) {
      setError(t('auth.errCaptcha'))
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      })
      if (signInError) throw signInError
      setSessionPreference(rememberMe)
      router.push(safeNext)
      router.refresh()
    } catch (err) {
      setError(authErrorMessage(t, err))
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsGoogleLoading(true)
    setSessionPreference(rememberMe)
    try {
      const supabase = createClient()
      const callbackUrl = safeNext !== '/pipeline'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
          queryParams: { access_type: 'offline' },
        },
      })
      if (oauthError) throw new Error(oauthError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errGoogleFailed'))
      setIsGoogleLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setError(null)
    setIsMicrosoftLoading(true)
    setSessionPreference(rememberMe)
    try {
      const supabase = createClient()
      const callbackUrl = safeNext !== '/pipeline'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: callbackUrl,
          scopes: 'email Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access',
        },
      })
      if (oauthError) throw new Error(oauthError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errMicrosoftFailed'))
      setIsMicrosoftLoading(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('auth.welcomeBack')}</CardTitle>
        <CardDescription>{t('auth.signInSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleLoading || isMicrosoftLoading || isLoading}>
            {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            <span className="ml-2">{t('auth.continueGoogle')}</span>
          </Button>

          <Button variant="outline" className="w-full" onClick={handleMicrosoftSignIn} disabled={isGoogleLoading || isMicrosoftLoading || isLoading}>
            {isMicrosoftLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
            <span className="ml-2">{t('auth.continueMicrosoft')}</span>
          </Button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t('auth.or')}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer select-none">
              {t('auth.keepSignedIn')}
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !captchaToken}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signingIn')}
              </>
            ) : (
              t('auth.signIn')
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

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">{t('auth.noAccount')} </span>
          <Link
            href={safeNext !== '/pipeline' ? `/auth/sign-up?next=${encodeURIComponent(safeNext)}` : '/auth/sign-up'}
            className="font-medium text-primary hover:underline"
          >
            {t('auth.signUp')}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
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
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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

function SignUpForm() {
  const [fullName, setFullName] = useState<string>('')
  const [companyName, setCompanyName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false)
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState<boolean>(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  const rawNext = searchParams.get('next') ?? ''
  const safeNext = rawNext.startsWith('/') ? rawNext : ''
  const isInviteFlow = safeNext.startsWith('/join')

  // Build the callback URL, carrying next through email confirmation if present
  function buildCallbackUrl() {
    const base = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
      ?? `${window.location.origin}/auth/callback`
    return safeNext ? `${base}?next=${encodeURIComponent(safeNext)}` : base
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: buildCallbackUrl(),
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
          },
        },
      })
      if (signUpError) throw new Error(signUpError.message)
      router.push('/auth/sign-up-success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.')
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const supabase = createClient()
      const callbackUrl = safeNext
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl },
      })
      if (oauthError) throw new Error(oauthError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google.')
      setIsGoogleLoading(false)
    }
  }

  const handleMicrosoftSignUp = async () => {
    setError(null)
    setIsMicrosoftLoading(true)
    try {
      const supabase = createClient()
      const callbackUrl = safeNext
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: { redirectTo: callbackUrl, scopes: 'email' },
      })
      if (oauthError) throw new Error(oauthError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Microsoft.')
      setIsMicrosoftLoading(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          {isInviteFlow ? 'Create an account to accept your invitation' : 'Start your free trial today'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={handleGoogleSignUp} disabled={isGoogleLoading || isMicrosoftLoading || isLoading}>
            {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            <span className="ml-2">Continue with Google</span>
          </Button>

          <Button variant="outline" className="w-full" onClick={handleMicrosoftSignUp} disabled={isGoogleLoading || isMicrosoftLoading || isLoading}>
            {isMicrosoftLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
            <span className="ml-2">Continue with Microsoft</span>
          </Button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {!isInviteFlow && (
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="mt-4 text-xs text-center text-muted-foreground">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">Terms and Conditions</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link
            href={safeNext ? `/auth/login?next=${encodeURIComponent(safeNext)}` : '/auth/login'}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SignUpPage() {
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
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  )
}

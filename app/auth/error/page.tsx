import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Briefcase, AlertTriangle, ArrowLeft } from 'lucide-react'
import { SignOutButton } from '@/components/auth/sign-out-button'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const isEmailMismatch = message?.toLowerCase().includes('different email')
  const isAlreadyInOrg = message?.toLowerCase().includes('already belongs')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
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
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">
              {isEmailMismatch ? 'Wrong account' : isAlreadyInOrg ? 'Already in an organization' : 'Authentication Error'}
            </CardTitle>
            <CardDescription className="text-base">
              {message ?? 'Something went wrong during the authentication process.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEmailMismatch && (
              <p className="text-sm text-muted-foreground text-center">
                Sign out below, then open the invitation link again and sign in with the correct account.
              </p>
            )}
            {isAlreadyInOrg && (
              <p className="text-sm text-muted-foreground text-center">
                Each account can only belong to one organization. Contact your current organization&apos;s owner if you need to switch.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {isEmailMismatch ? (
                <SignOutButton />
              ) : (
                <Button className="w-full" asChild>
                  <Link href="/auth/login">Try signing in</Link>
                </Button>
              )}
              {isAlreadyInOrg && (
                <Button className="w-full" asChild>
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

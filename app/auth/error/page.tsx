import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
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
  const t = await getTranslations()
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
              {isEmailMismatch ? t('auth.errorWrongAccount') : isAlreadyInOrg ? t('auth.errorAlreadyInOrg') : t('auth.errorTitle')}
            </CardTitle>
            <CardDescription className="text-base">
              {message ?? t('auth.errorGeneric')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEmailMismatch && (
              <p className="text-sm text-muted-foreground text-center">
                {t('auth.errorEmailMismatchBody')}
              </p>
            )}
            {isAlreadyInOrg && (
              <p className="text-sm text-muted-foreground text-center">
                {t('auth.errorAlreadyInOrgBody')}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {isEmailMismatch ? (
                <SignOutButton />
              ) : (
                <Button className="w-full" asChild>
                  <Link href="/auth/login">{t('auth.trySigningIn')}</Link>
                </Button>
              )}
              {isAlreadyInOrg && (
                <Button className="w-full" asChild>
                  <Link href="/pipeline">{t('auth.goToPipeline')}</Link>
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  {t('auth.backToHome')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

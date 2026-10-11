import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Briefcase, Mail, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignOutLink } from '@/components/auth/sign-out-link'
import { dateFnsLocale, formatShortDate } from '@/lib/i18n/date-locale'

const GRACE_DAYS = 30

export default async function AccountDeletionScheduledPage() {
  const t = await getTranslations()
  const dfLocale = dateFnsLocale(await getLocale())
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public-readable page: unauthenticated visitors get a generic message
  // explaining what this URL is for. Authenticated users with an active org
  // (deleted_at IS NULL) shouldn't be here — bounce them back to the app.
  let orgName: string | null = null
  let scheduledAt: Date | null = null
  let daysRemaining: number | null = null

  if (user) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profile?.organization_id) {
      const { data: organization } = await admin
        .from('organizations')
        .select('name, deleted_at')
        .eq('id', profile.organization_id)
        .single()

      if (organization) {
        if (!organization.deleted_at) {
          // Org isn't scheduled for deletion — this page is the wrong place
          // for this user. Send them home.
          redirect('/pipeline')
        }
        orgName = organization.name as string
        scheduledAt = new Date(organization.deleted_at as string)
        const elapsedMs = Date.now() - scheduledAt.getTime()
        const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000))
        daysRemaining = Math.max(0, GRACE_DAYS - elapsedDays)
      }
    }
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
            <CardTitle className="text-2xl">{t('deletionPage.title')}</CardTitle>
            <CardDescription>
              {orgName
                ? t('deletionPage.descOrg', { org: orgName })
                : t('deletionPage.descGeneric')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-sm">
            {daysRemaining !== null && scheduledAt && (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Calendar className="h-4 w-4" />
                  {t('deletionPage.daysRemaining', { count: daysRemaining })}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t('deletionPage.scheduledFor', {
                    date: formatShortDate(
                      new Date(scheduledAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000),
                      dfLocale,
                    ),
                  })}
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-foreground">{t('deletionPage.duringTitle')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t('deletionPage.during1')}</li>
                <li>{t('deletionPage.during2')}</li>
                <li>{t('deletionPage.during3')}</li>
                <li>{t('deletionPage.during4')}</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground">{t('deletionPage.afterTitle')}</h3>
              <p className="mt-1 text-muted-foreground">
                {t.rich('deletionPage.afterBody', {
                  link: (c) => (
                    <Link href="/privacy" className="underline hover:text-foreground">
                      {c}
                    </Link>
                  ),
                })}
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-4 w-4" />
                {t('deletionPage.helpTitle')}
              </div>
              <p className="mt-1 text-muted-foreground">
                {t.rich('deletionPage.helpBody', {
                  email: (c) => (
                    <a href="mailto:support@hrhandle.com" className="underline hover:text-foreground">
                      {c}
                    </a>
                  ),
                })}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              {user ? (
                <SignOutLink className="w-full">
                  <Button variant="outline" className="w-full">
                    {t('header.signOut')}
                  </Button>
                </SignOutLink>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/login">{t('auth.signIn')}</Link>
                </Button>
              )}
              <Button asChild variant="ghost" className="w-full">
                <Link href="/">{t('deletionPage.home')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

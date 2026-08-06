import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MfaChallengeForm } from '@/components/mfa/mfa-challenge-form'

export const metadata = { title: 'Two-factor authentication — HRHandle' }

type SearchParams = Promise<{ next?: string }>

export default async function MfaChallengePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel === 'aal2') {
    // Already at AAL2; just send them on.
    redirect(sp.next ?? '/pipeline')
  }

  const next = sp.next ?? '/pipeline'
  const t = await getTranslations()

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('mfa.twoFactor')}</CardTitle>
          <CardDescription>
            {t('mfa.challengeSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaChallengeForm next={next} />
        </CardContent>
      </Card>
    </div>
  )
}

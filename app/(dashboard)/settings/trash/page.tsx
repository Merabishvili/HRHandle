import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { createClient } from '@/lib/supabase/server'
import { getTrashedCandidates, getTrashedVacancies } from '@/lib/actions/restore'
import { TrashList } from '@/components/settings/trash-list'

export const dynamic = 'force-dynamic'

export default async function TrashSettingsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/pipeline')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const [candidatesResult, vacanciesResult] = await Promise.all([
    getTrashedCandidates(),
    getTrashedVacancies(),
  ])

  if (!candidatesResult.success || !vacanciesResult.success) {
    redirect('/settings/profile')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('settingsPage.trash')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settingsPage.trashSub')}
        </p>
      </div>

      <TrashList
        candidates={candidatesResult.data}
        vacancies={vacanciesResult.data}
      />
    </div>
  )
}

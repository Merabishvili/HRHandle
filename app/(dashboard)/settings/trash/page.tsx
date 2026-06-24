import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getTrashedCandidates, getTrashedVacancies } from '@/lib/actions/restore'
import { TrashList } from '@/components/settings/trash-list'

export const dynamic = 'force-dynamic'

export default async function TrashSettingsPage() {
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
        <h2 className="text-lg font-semibold text-foreground">Trash</h2>
        <p className="text-sm text-muted-foreground">
          Soft-deleted candidates and vacancies stay here for 30 days. After that, the daily purge cron irreversibly removes them. Restore brings them back into the dashboard; for candidates, any applications that were cascade-deleted with them are restored too.
        </p>
      </div>

      <TrashList
        candidates={candidatesResult.data}
        vacancies={vacanciesResult.data}
      />
    </div>
  )
}

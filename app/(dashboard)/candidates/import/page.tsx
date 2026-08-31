import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImportFlow } from '@/components/candidate-import/import-flow'
import { isOrgAdmin } from '@/lib/permissions'

export const metadata = {
  title: 'Bulk import candidates',
}

// The commit runs as a background job via `after()`; give it headroom.
export const maxDuration = 60

export default async function ImportCandidatesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/pipeline')
  if (!isOrgAdmin(profile.role as 'owner' | 'admin' | 'member')) {
    redirect('/candidates')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <ImportFlow userName={profile.full_name ?? undefined} />
    </div>
  )
}

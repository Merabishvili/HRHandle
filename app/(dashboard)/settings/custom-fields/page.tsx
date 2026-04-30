import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'

export default async function CustomFieldsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const [candidateGroups, vacancyGroups] = await Promise.all([
    getCustomFieldSchema('candidate'),
    getCustomFieldSchema('vacancy'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Custom Fields</h2>
        <p className="text-sm text-muted-foreground">
          Define custom fields for candidates and vacancies. Up to 20 fields per entity type.
        </p>
      </div>
      <CustomFieldsManager
        candidateGroups={candidateGroups}
        vacancyGroups={vacancyGroups}
      />
    </div>
  )
}

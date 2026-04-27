import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RejectionReasonsManager } from '@/components/settings/rejection-reasons-manager'
import { getRejectionReasons } from '@/lib/actions/rejection-reasons'

export default async function RejectionReasonsSettingsPage() {
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

  const result = await getRejectionReasons()
  const reasons = result.success ? result.data : []

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Rejection Reasons</h2>
        <p className="text-sm text-muted-foreground">
          Define the reasons used when a candidate is not moving forward. Up to 50 reasons.
        </p>
      </div>
      <RejectionReasonsManager initialReasons={reasons} />
    </div>
  )
}

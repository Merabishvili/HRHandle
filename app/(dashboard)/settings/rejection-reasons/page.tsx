import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RejectionReasonsManager } from '@/components/settings/rejection-reasons-manager'
import { RejectionTemplatesManager } from '@/components/settings/rejection-templates-manager'
import { getRejectionReasons } from '@/lib/actions/rejection-reasons'
import { getRejectionTemplates } from '@/lib/actions/rejection-templates'

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

  const [reasonsResult, templatesResult] = await Promise.all([
    getRejectionReasons(),
    getRejectionTemplates(),
  ])

  return (
    <div className="max-w-2xl space-y-10">
      {/* Rejection Reasons */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Rejection Reasons</h2>
          <p className="text-sm text-muted-foreground">
            Define the reasons used when a candidate is not moving forward. Up to 50 reasons.
          </p>
        </div>
        <RejectionReasonsManager initialReasons={reasonsResult.success ? reasonsResult.data : []} />
      </div>

      <div className="border-t border-border" />

      {/* Rejection Email Templates */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Rejection Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Configure the emails sent when rejecting a candidate. With one template it is auto-selected; with multiple you can choose at rejection time.
          </p>
        </div>
        <RejectionTemplatesManager initialTemplates={templatesResult.success ? templatesResult.data : []} />
      </div>
    </div>
  )
}

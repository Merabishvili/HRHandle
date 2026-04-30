import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmailTemplatesManager } from '@/components/settings/email-templates-manager'
import { getEmailTemplates } from '@/lib/actions/email-templates'
import { getRejectionTemplates } from '@/lib/actions/rejection-templates'
import { getRejectionReasons } from '@/lib/actions/rejection-reasons'

export default async function EmailTemplatesSettingsPage() {
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

  const [emailResult, rejectionTemplatesResult, rejectionReasonsResult] = await Promise.all([
    getEmailTemplates(),
    getRejectionTemplates(),
    getRejectionReasons(),
  ])

  if (!emailResult.success) redirect('/settings/profile')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Email Templates</h2>
        <p className="text-sm text-muted-foreground">
          Customise the emails sent to candidates. Use variables to personalise the content.
        </p>
      </div>
      <EmailTemplatesManager
        initialTemplates={emailResult.data}
        initialRejectionTemplates={rejectionTemplatesResult.success ? rejectionTemplatesResult.data : []}
        rejectionReasons={rejectionReasonsResult.success ? rejectionReasonsResult.data : []}
      />
    </div>
  )
}

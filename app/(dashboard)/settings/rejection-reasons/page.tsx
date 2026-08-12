import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { RejectionReasonsManager } from '@/components/settings/rejection-reasons-manager'
import { getRejectionReasons } from '@/lib/actions/rejection-reasons'
import { getRejectionTemplates } from '@/lib/actions/rejection-templates'

export default async function RejectionReasonsSettingsPage() {
  const tr = await getTranslations()
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

  const [reasonsResult, templatesResult] = await Promise.all([
    getRejectionReasons(),
    getRejectionTemplates(),
  ])

  // Which reasons already have a linked email template — surfaced per-reason so
  // admins can see, from this page, whether a reason falls back to the default
  // copy or has its own.
  const reasonIdsWithTemplate = templatesResult.success
    ? templatesResult.data
        .map((t) => t.reason_id)
        .filter((id): id is string => !!id)
    : []

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('settingsPage.rejectionReasons')}</h2>
        <p className="text-sm text-muted-foreground">
          {tr.rich('settingsPage.rejectionReasonsSub', {
            link: (c) => <a href="/settings/email-templates" className="underline underline-offset-2 hover:text-foreground">{c}</a>,
          })}
        </p>
      </div>
      <RejectionReasonsManager
        initialReasons={reasonsResult.success ? reasonsResult.data : []}
        reasonIdsWithTemplate={reasonIdsWithTemplate}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { isOrgAdmin } from '@/lib/permissions'
import { listWebhooks } from '@/lib/actions/webhook-notifications'
import { WebhooksManager } from '@/components/integrations/webhooks-manager'

export const metadata = { title: 'Slack & Teams notifications — HRHandle' }

export default async function WebhooksSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) redirect('/pipeline')
  if (!isOrgAdmin(profile.role as 'owner' | 'admin' | 'member')) {
    redirect('/settings/integrations')
  }

  const result = await listWebhooks()
  const webhooks = result.success ? result.data : []

  return (
    <div className="max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href="/settings/integrations">
          <ArrowLeft className="h-4 w-4" /> Back to integrations
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Slack &amp; Microsoft Teams notifications</h1>
        <p className="text-sm text-muted-foreground">
          Add an incoming webhook URL from Slack or Teams, choose which events to receive, and HRHandle will POST messages to that channel.
        </p>
      </div>

      <WebhooksManager initial={webhooks} />
    </div>
  )
}

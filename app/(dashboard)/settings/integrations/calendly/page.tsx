import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isOrgAdmin } from '@/lib/permissions'
import { getCalendlyStatus } from '@/lib/actions/calendly'
import { CalendlyEventTypePicker } from '@/components/integrations/calendly-event-type-picker'
import { DisconnectCalendlyButton } from '@/components/integrations/disconnect-calendly-button'

export const metadata = { title: 'Calendly — HRHandle' }

type SearchParams = Promise<{ error?: string; connected?: string }>

export default async function CalendlySettingsPage({ searchParams }: { searchParams: SearchParams }) {
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

  const sp = await searchParams
  const statusResult = await getCalendlyStatus()
  const status = statusResult.success ? statusResult.data : null

  return (
    <div className="max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link href="/settings/integrations">
          <ArrowLeft className="h-4 w-4" /> Back to integrations
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendly</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Calendly account so candidates can book interviews directly. When they book, HRHandle creates the interview record and links it to the candidate&apos;s application.
        </p>
      </div>

      {sp.error && (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(sp.error)}</AlertDescription>
        </Alert>
      )}
      {sp.connected === '1' && (
        <Alert>
          <AlertDescription>Calendly connected. Pick an event type below.</AlertDescription>
        </Alert>
      )}

      {!status && (
        <Alert variant="destructive">
          <AlertDescription>Could not load integration status.</AlertDescription>
        </Alert>
      )}

      {status && !status.configured && (
        <Alert variant="destructive">
          <AlertDescription>
            Calendly OAuth secrets are not configured on this HRHandle instance. Ask your administrator to set them on the deployment.
          </AlertDescription>
        </Alert>
      )}

      {status?.configured && !status.connected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CalendarIcon className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No Calendly account connected</p>
              <p className="text-sm text-muted-foreground">Sign in with Calendly to get started.</p>
            </div>
            <Button asChild>
              <a href="/api/auth/calendly">Connect Calendly</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {status?.connected && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">Connected as {status.external_user_name ?? 'Calendly user'}</p>
                <p className="text-sm text-muted-foreground">
                  HRHandle will receive webhook events when candidates book or cancel.
                </p>
              </div>
              <DisconnectCalendlyButton />
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Event type used for candidate interviews</p>
              <CalendlyEventTypePicker
                selectedUri={status.selected_event_type_uri}
                eventTypes={status.available_event_types ?? []}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

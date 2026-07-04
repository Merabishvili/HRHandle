import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleCalendarConnect } from '@/components/settings/google-calendar-connect'
import { ZoomConnect } from '@/components/settings/zoom-connect'
import { MicrosoftConnect } from '@/components/settings/microsoft-connect'
import { LinkedInConnect } from '@/components/settings/linkedin-connect'
import { DefaultMeetingProviderSelect } from '@/components/settings/default-meeting-provider-select'
import { getLinkedInIntegration } from '@/lib/actions/integrations'
import type { DefaultMeetingProvider } from '@/lib/actions/settings'
import Link from 'next/link'
import { Bell, Calendar as CalendarIcon } from 'lucide-react'

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token, zoom_refresh_token, microsoft_refresh_token, default_meeting_provider')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/pipeline')

  const linkedInIntegration = await getLinkedInIntegration()

  const hasGoogle = !!profile.google_refresh_token
  const hasZoom = !!profile.zoom_refresh_token
  const hasTeams = !!profile.microsoft_refresh_token
  // "Default for video interviews" only matters once there's a choice to make.
  const showDefaultProvider = [hasGoogle, hasZoom, hasTeams].filter(Boolean).length >= 2

  return (
    <div className="max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect external services to enhance your workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Suspense fallback={null}>
              <GoogleCalendarConnect isConnected={!!profile.google_refresh_token} />
            </Suspense>
            <div className="border-t border-border pt-6">
              <Suspense fallback={null}>
                <ZoomConnect isConnected={!!profile.zoom_refresh_token} />
              </Suspense>
            </div>
            <div className="border-t border-border pt-6">
              <Suspense fallback={null}>
                <MicrosoftConnect isConnected={hasTeams} />
              </Suspense>
            </div>
            {showDefaultProvider && (
              <div className="border-t border-border pt-6">
                <DefaultMeetingProviderSelect
                  current={(profile.default_meeting_provider as DefaultMeetingProvider | null) ?? null}
                  hasGoogle={hasGoogle}
                  hasZoom={hasZoom}
                  hasTeams={hasTeams}
                />
              </div>
            )}
            <div className="border-t border-border pt-6">
              <Suspense fallback={null}>
                <LinkedInConnect integration={linkedInIntegration} />
              </Suspense>
            </div>
            <div className="border-t border-border pt-6">
              <Link
                href="/settings/integrations/webhooks"
                className="flex items-center justify-between gap-4 rounded-md border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start gap-3">
                  <Bell className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Slack &amp; Microsoft Teams notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Send messages to your team when applications, offers, and interviews change.
                      This is a separate connection from <span className="font-medium">Microsoft (Calendar + Teams)</span> above —
                      that one creates Teams <em>meetings</em>; this one posts team <em>notifications</em>.
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-primary">Configure →</span>
              </Link>
            </div>
            <div className="border-t border-border pt-6">
              <Link
                href="/settings/integrations/calendly"
                className="flex items-center justify-between gap-4 rounded-md border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start gap-3">
                  <CalendarIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Calendly</p>
                    <p className="text-sm text-muted-foreground">
                      Let candidates self-schedule interviews directly from your Calendly link.
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-primary">Configure →</span>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

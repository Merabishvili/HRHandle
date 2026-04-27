import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleCalendarConnect } from '@/components/settings/google-calendar-connect'
import { ZoomConnect } from '@/components/settings/zoom-connect'

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token, zoom_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

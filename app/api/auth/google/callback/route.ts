import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, hasRequiredCalendarScopes } from '@/lib/google/calendar'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    console.warn('[google/callback] denied or missing params:', { error, hasCode: !!code, hasState: !!state })
    return NextResponse.redirect(new URL('/settings/integrations?google=denied', BASE))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('google_oauth_state')?.value
  cookieStore.delete('google_oauth_state')

  if (state !== savedState) {
    console.error('[google/callback] state mismatch — cookie missing or stale (likely user took >10min or cookies blocked)')
    return NextResponse.redirect(new URL('/settings/integrations?google=state_mismatch', BASE))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const tokens = await exchangeCodeForTokens(code)
  if (!tokens) {
    // exchangeCodeForTokens logs the underlying Google response.
    return NextResponse.redirect(new URL('/settings/integrations?google=token_exchange_failed', BASE))
  }

  if (!hasRequiredCalendarScopes(tokens.scope)) {
    console.error('[google/callback] insufficient scopes granted, scope=', tokens.scope ?? '(none)')
    return NextResponse.redirect(new URL('/settings/integrations?google=scope_missing', BASE))
  }

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expiry: Date.now() + tokens.expires_in * 1000,
    })
    .eq('id', user.id)

  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profile?.organization_id) {
    void writeAuditLog({
      orgId: profile.organization_id,
      userId: user.id,
      entityType: 'integration',
      entityId: null,
      action: 'connected',
      message: 'Google Calendar integration connected',
      details: { platform: 'google_calendar' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?google=connected', BASE))
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeMicrosoftCode } from '@/lib/microsoft/graph'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    // Microsoft returned an OAuth error (e.g. access_denied, consent_required)
    // or dropped a param. Log the description so the real reason is visible.
    console.warn('[microsoft/callback] denied or missing params:', {
      error,
      errorDescription: searchParams.get('error_description')?.slice(0, 300),
      hasCode: !!code,
      hasState: !!state,
    })
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=denied', BASE))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('microsoft_oauth_state')?.value
  cookieStore.delete('microsoft_oauth_state')

  if (state !== savedState) {
    console.error('[microsoft/callback] state mismatch — cookie missing or stale (likely user took >10min or cookies blocked)')
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=state_mismatch', BASE))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const tokens = await exchangeMicrosoftCode(code)
  if (!tokens) {
    // exchangeMicrosoftCode logs the underlying Azure response (AADSTS code).
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=token_exchange_failed', BASE))
  }

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      microsoft_access_token: tokens.access_token,
      microsoft_refresh_token: tokens.refresh_token,
      microsoft_token_expiry: Date.now() + tokens.expires_in * 1000,
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
      message: 'Microsoft Teams integration connected',
      details: { platform: 'microsoft_teams' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?microsoft=connected', BASE))
}

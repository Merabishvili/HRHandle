import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeZoomCode, fetchZoomUserId } from '@/lib/zoom/meetings'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('zoom_oauth_state')?.value

  // Diagnostic: distinguish which step failed via ?zoom=error&reason=… (the UI
  // still shows the same message; the reason is for debugging the OAuth flow).
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings/integrations?zoom=error&reason=${reason}`, BASE))

  if (!code || !state) {
    console.error('[zoom/callback] missing code/state', { hasCode: !!code, hasState: !!state })
    return fail('missing')
  }
  if (state !== savedState) {
    console.error('[zoom/callback] state mismatch', { hasSavedState: !!savedState })
    return fail('state')
  }

  cookieStore.delete('zoom_oauth_state')

  // Verify the authenticated session — do not trust the state parameter for identity
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const tokens = await exchangeZoomCode(code)
  if (!tokens) {
    return fail('exchange')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      zoom_access_token: tokens.access_token,
      zoom_refresh_token: tokens.refresh_token,
      zoom_token_expiry: Date.now() + tokens.expires_in * 1000,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[zoom/callback] profile token update failed:', error.message)
    return fail('db')
  }

  // Store the Zoom user id so the deauthorization webhook can find whose tokens
  // to delete on uninstall. Best-effort + separate update: a failure here (e.g.
  // the column isn't migrated yet) must not fail an otherwise-successful connect.
  const zoomUserId = await fetchZoomUserId(tokens.access_token)
  if (zoomUserId) {
    await admin.from('profiles').update({ zoom_user_id: zoomUserId }).eq('id', user.id)
  }

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
      message: 'Zoom integration connected',
      details: { platform: 'zoom' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?zoom=connected', BASE))
}

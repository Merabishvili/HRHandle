import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeZoomCode } from '@/lib/zoom/meetings'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('zoom_oauth_state')?.value

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL('/settings/integrations?zoom=error', BASE))
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
    return NextResponse.redirect(new URL('/settings/integrations?zoom=error', BASE))
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
    return NextResponse.redirect(new URL('/settings/integrations?zoom=error', BASE))
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

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): see app/api/auth/google/disconnect/route.ts for the
// shared rationale — relies on SameSite=Lax Supabase session cookies and the
// Next.js same-origin route handler model.
//
// No upstream revoke call (G-006): unlike Google and Zoom, Microsoft Entra has
// no documented programmatic OAuth 2.0 revoke endpoint for refresh tokens. The
// `end_session_endpoint` performs a global sign-out across every Microsoft
// app on the device, which is too aggressive for a per-integration disconnect.
// Deleting our stored tokens locally is sufficient to prevent HRHandle from
// using the grant going forward; the dangling refresh token in Entra expires
// on Microsoft's own schedule (typically 90 days of inactivity). Users wanting
// absolute revocation can remove HRHandle from their authorised apps at
// https://myaccount.microsoft.com/.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  await supabase
    .from('profiles')
    .update({
      microsoft_access_token: null,
      microsoft_refresh_token: null,
      microsoft_token_expiry: null,
    })
    .eq('id', user.id)

  const { data: profile } = await supabase
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
      action: 'disconnected',
      message: 'Microsoft Teams integration disconnected',
      details: { platform: 'microsoft_teams' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?microsoft=disconnected', BASE))
}

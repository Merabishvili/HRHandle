import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit-log'
import { revokeZoomToken } from '@/lib/zoom/meetings'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): see app/api/auth/google/disconnect/route.ts for the
// shared rationale — relies on SameSite=Lax Supabase session cookies and the
// Next.js same-origin route handler model.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  // Read the current access token before NULLing so we can revoke upstream
  // first. Zoom's revoke endpoint expects the access token specifically
  // (different from Google, which prefers the refresh token).
  const { data: tokens } = await supabase
    .from('profiles')
    .select('zoom_access_token')
    .eq('id', user.id)
    .single()

  const tokenToRevoke = (tokens?.zoom_access_token as string | null) ?? null

  // Best-effort upstream revoke (G-006). Continue with local NULL on failure
  // so the user isn't blocked from disconnecting.
  if (tokenToRevoke) {
    try {
      await revokeZoomToken(tokenToRevoke)
    } catch (err) {
      console.warn('[disconnect/zoom] upstream revoke failed:', err)
    }
  }

  await supabase
    .from('profiles')
    .update({ zoom_access_token: null, zoom_refresh_token: null, zoom_token_expiry: null })
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
      message: 'Zoom integration disconnected',
      details: { platform: 'zoom' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?zoom=disconnected', BASE))
}

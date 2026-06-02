import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit-log'
import { revokeGoogleToken } from '@/lib/google/calendar'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): this route mutates auth state but has no explicit
// CSRF token. Protection relies on (a) Supabase session cookies being
// SameSite=Lax (set by `@supabase/ssr`), so a cross-site POST does not include
// the session and `getUser()` returns null → redirect to login; and (b) the
// Next.js same-origin Server Action / route handler model. Do not loosen the
// Supabase cookie SameSite without re-evaluating.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  // Read the current tokens before NULLing so we can revoke upstream first.
  // Prefer the refresh token — revoking it kills the whole grant on Google's
  // side. Fall back to the access token if no refresh token is stored.
  const { data: tokens } = await supabase
    .from('profiles')
    .select('google_refresh_token, google_access_token')
    .eq('id', user.id)
    .single()

  const tokenToRevoke =
    (tokens?.google_refresh_token as string | null) ??
    (tokens?.google_access_token as string | null)

  // Best-effort upstream revoke (G-006). Local NULL is what actually fulfils
  // the user's intent — even if Google's endpoint is unreachable, we still
  // proceed so the user isn't blocked from disconnecting.
  if (tokenToRevoke) {
    try {
      await revokeGoogleToken(tokenToRevoke)
    } catch (err) {
      console.warn('[disconnect/google] upstream revoke failed:', err)
    }
  }

  await supabase
    .from('profiles')
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
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
      message: 'Google Calendar integration disconnected',
      details: { platform: 'google_calendar' },
    })
  }

  return NextResponse.redirect(new URL('/settings/integrations?google=disconnected', BASE))
}

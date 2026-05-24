import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit-log'

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

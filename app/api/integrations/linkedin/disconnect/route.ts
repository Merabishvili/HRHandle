import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): see app/api/auth/google/disconnect/route.ts for the
// shared rationale — relies on SameSite=Lax Supabase session cookies and the
// Next.js same-origin route handler model.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', BASE))

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

  const admin = createAdminClient()
  await admin
    .from('organization_integrations')
    .delete()
    .eq('organization_id', profile.organization_id)
    .eq('platform', 'linkedin')

  void writeAuditLog({
    orgId: profile.organization_id,
    userId: user.id,
    entityType: 'integration',
    entityId: null,
    action: 'disconnected',
    message: 'LinkedIn integration disconnected',
    details: { platform: 'linkedin' },
  })

  return NextResponse.redirect(new URL('/settings/integrations?linkedin=disconnected', BASE))
}

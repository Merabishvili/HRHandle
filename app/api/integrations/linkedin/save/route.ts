import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function extractNumericPageId(input: string): string | null {
  if (!input) return null
  const urlMatch = input.match(/linkedin\.com\/company\/(\d+)/)
  if (urlMatch && urlMatch[1]) return urlMatch[1]
  if (/^\d+$/.test(input)) return input
  return null
}

export async function POST(request: NextRequest) {
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

  const body = await request.formData()
  const raw = body.get('page_id')?.toString().trim() ?? ''
  const pageId = extractNumericPageId(raw)

  if (!pageId) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=invalid_page_id', BASE))
  }

  const admin = createAdminClient()
  const { error } = await admin.from('organization_integrations').upsert(
    {
      organization_id: profile.organization_id,
      platform: 'linkedin',
      external_page_id: pageId,
      external_page_name: pageId,
      access_token: 'manual',
      token_expires_at: null,
      connected_by: user.id,
      connected_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: 'organization_id,platform' }
  )

  if (error) {
    console.error('[linkedin/save] upsert error:', error)
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

  void writeAuditLog({
    orgId: profile.organization_id,
    userId: user.id,
    entityType: 'integration',
    entityId: null,
    action: 'connected',
    message: `LinkedIn company page ${pageId} connected`,
    details: { platform: 'linkedin', external_page_id: pageId },
  })

  return NextResponse.redirect(new URL('/settings/integrations?linkedin=connected', BASE))
}

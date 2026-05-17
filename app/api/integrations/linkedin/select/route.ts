import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const pendingRaw = cookieStore.get('linkedin_pending')?.value
  if (!pendingRaw) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

  let pending: { accessToken: string; expiresIn: number; pages: Array<{ id: string; name: string }> }
  try {
    pending = JSON.parse(pendingRaw)
  } catch {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

  const formData = await request.formData()
  const pageId = formData.get('page_id')?.toString()
  const selectedPage = pending.pages.find((p) => p.id === pageId)

  if (!selectedPage) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

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
  await admin.from('organization_integrations').upsert(
    {
      organization_id: profile.organization_id,
      platform: 'linkedin',
      external_page_id: selectedPage.id,
      external_page_name: selectedPage.name,
      access_token: pending.accessToken,
      token_expires_at: new Date(Date.now() + pending.expiresIn * 1000).toISOString(),
      connected_by: user.id,
      connected_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: 'organization_id,platform' }
  )

  cookieStore.delete('linkedin_pending')
  return NextResponse.redirect(new URL('/settings/integrations?linkedin=connected', BASE))
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

type LinkedInPage = { id: string; name: string }

async function fetchOrgPages(accessToken: string): Promise<LinkedInPage[]> {
  const aclRes = await fetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
    { headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' } }
  )
  if (!aclRes.ok) return []

  const aclData = await aclRes.json()
  const elements: Array<{ organization: string }> = aclData.elements ?? []
  if (elements.length === 0) return []

  const pages = await Promise.all(
    elements.map(async (el) => {
      const urn = el.organization // "urn:li:organization:12345"
      const id = urn.split(':').pop() ?? ''
      const orgRes = await fetch(
        `https://api.linkedin.com/v2/organizations/${id}?projection=(id,name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!orgRes.ok) return null
      const org = await orgRes.json()
      const localized = org?.name?.localized ?? {}
      const name = localized[Object.keys(localized)[0]] ?? `Company ${id}`
      return { id, name } as LinkedInPage
    })
  )

  return pages.filter((p): p is LinkedInPage => p !== null)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=denied', BASE))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('linkedin_oauth_state')?.value
  cookieStore.delete('linkedin_oauth_state')

  if (state !== savedState) {
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

  // Exchange code for access token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${BASE}/api/integrations/linkedin/callback`,
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=error', BASE))
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const expiresIn: number = tokenData.expires_in ?? 5184000 // default 60 days

  const pages = await fetchOrgPages(accessToken)

  if (pages.length === 0) {
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=no_pages', BASE))
  }

  // If exactly one page, save immediately
  if (pages.length === 1) {
    const admin = createAdminClient()
    await admin.from('organization_integrations').upsert(
      {
        organization_id: profile.organization_id,
        platform: 'linkedin',
        external_page_id: pages[0].id,
        external_page_name: pages[0].name,
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: 'organization_id,platform' }
    )
    return NextResponse.redirect(new URL('/settings/integrations?linkedin=connected', BASE))
  }

  // Multiple pages — store token in short-lived cookie and redirect to picker
  cookieStore.set(
    'linkedin_pending',
    JSON.stringify({ accessToken, expiresIn, pages }),
    { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 300, path: '/' }
  )
  return NextResponse.redirect(new URL('/settings/integrations/linkedin/select', BASE))
}

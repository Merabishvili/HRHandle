import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { exchangeMicrosoftCode } from '@/lib/microsoft/graph'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=denied', BASE))
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('microsoft_oauth_state')?.value
  cookieStore.delete('microsoft_oauth_state')

  if (state !== savedState) {
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=error', BASE))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const tokens = await exchangeMicrosoftCode(code)
  if (!tokens) {
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=error', BASE))
  }

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      microsoft_access_token: tokens.access_token,
      microsoft_refresh_token: tokens.refresh_token,
      microsoft_token_expiry: Date.now() + tokens.expires_in * 1000,
    })
    .eq('id', user.id)

  return NextResponse.redirect(new URL('/settings/integrations?microsoft=connected', BASE))
}

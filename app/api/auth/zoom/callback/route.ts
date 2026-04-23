import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeZoomCode } from '@/lib/zoom/meetings'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('zoom_oauth_state')?.value

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL('/settings?zoom=error', BASE))
  }

  cookieStore.delete('zoom_oauth_state')

  const userId = Buffer.from(state, 'base64url').toString('utf8')

  const tokens = await exchangeZoomCode(code)
  if (!tokens) {
    return NextResponse.redirect(new URL('/settings?zoom=error', BASE))
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      zoom_access_token: tokens.access_token,
      zoom_refresh_token: tokens.refresh_token,
      zoom_token_expiry: Date.now() + tokens.expires_in * 1000,
    })
    .eq('id', userId)

  if (error) {
    return NextResponse.redirect(new URL('/settings?zoom=error', BASE))
  }

  return NextResponse.redirect(new URL('/settings?zoom=connected', BASE))
}

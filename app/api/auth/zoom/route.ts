import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getZoomOAuthUrl } from '@/lib/zoom/meetings'
import { env } from '@/lib/env'

export async function GET() {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/settings?zoom=not_configured', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    )
  }

  const state = Buffer.from(user.id).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set('zoom_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, path: '/' })

  return NextResponse.redirect(getZoomOAuthUrl(state))
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/google/calendar'
import { env } from '@/lib/env'

export async function GET() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings/integrations?google=not_configured', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))
  }

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  const cookieStore = await cookies()
  // sameSite=lax (not strict) is required for OAuth state cookies: when Google
  // redirects the user back to /api/auth/google/callback, the browser treats
  // it as a cross-site navigation and `strict` cookies are NOT sent. `lax`
  // allows the cookie on top-level navigations like this OAuth round-trip
  // while still blocking cross-site sub-requests for CSRF protection.
  cookieStore.set('google_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })

  return NextResponse.redirect(getGoogleOAuthUrl(state))
}

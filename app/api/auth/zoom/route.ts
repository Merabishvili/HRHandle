import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getZoomOAuthUrl } from '@/lib/zoom/meetings'
import { env } from '@/lib/env'

export async function GET() {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/settings/integrations?zoom=not_configured', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    )
  }

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  const cookieStore = await cookies()
  // sameSite=lax (not strict) — see app/api/auth/google/route.ts for the
  // shared rationale: strict cookies aren't sent on the cross-site navigation
  // that happens when the provider redirects the user back to our callback.
  cookieStore.set('zoom_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })

  return NextResponse.redirect(getZoomOAuthUrl(state))
}

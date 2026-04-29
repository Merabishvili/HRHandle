import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftOAuthUrl } from '@/lib/microsoft/graph'
import { env } from '@/lib/env'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings/integrations?microsoft=not_configured', BASE))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const state = Buffer.from(user.id).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set('microsoft_oauth_state', state, { httpOnly: true, secure: true, maxAge: 600, path: '/' })

  return NextResponse.redirect(getMicrosoftOAuthUrl(state))
}

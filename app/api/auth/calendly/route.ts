import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl, isCalendlyConfigured } from '@/lib/calendly/oauth'

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function GET() {
  if (!isCalendlyConfigured()) {
    return NextResponse.redirect(new URL('/settings/integrations/calendly?error=not_configured', siteUrl()))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', siteUrl()))
  }

  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
  const store = await cookies()
  store.set('calendly_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const redirectUri = `${siteUrl().replace(/\/$/, '')}/api/auth/calendly/callback`
  return NextResponse.redirect(buildAuthorizeUrl(redirectUri, state))
}

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { completeCalendlyConnect } from '@/lib/actions/calendly'

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(new URL(`/settings/integrations/calendly?error=${encodeURIComponent(errorParam)}`, siteUrl()))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings/integrations/calendly?error=missing_params', siteUrl()))
  }

  const store = await cookies()
  const expected = store.get('calendly_oauth_state')?.value
  if (!expected || expected !== state) {
    return NextResponse.redirect(new URL('/settings/integrations/calendly?error=bad_state', siteUrl()))
  }
  store.delete('calendly_oauth_state')

  const redirectUri = `${siteUrl().replace(/\/$/, '')}/api/auth/calendly/callback`
  const res = await completeCalendlyConnect(code, redirectUri)
  if (!res.success) {
    return NextResponse.redirect(new URL(`/settings/integrations/calendly?error=${encodeURIComponent(res.error)}`, siteUrl()))
  }
  return NextResponse.redirect(new URL('/settings/integrations/calendly?connected=1', siteUrl()))
}

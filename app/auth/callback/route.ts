import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/pipeline'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const { provider_token, provider_refresh_token, user } = data.session
      const provider = user.app_metadata?.provider as string | undefined

      // Auto-connect calendar integration when signing in with Google or Microsoft.
      // The sign-in OAuth already requested the calendar/Teams scopes, so we store
      // the provider tokens directly — no separate integration OAuth needed.
      if (provider_token && (provider === 'google' || provider === 'azure')) {
        try {
          const admin = createAdminClient()
          // Standard OAuth access tokens expire in 1 hour
          const tokenExpiry = Date.now() + 3600 * 1000

          if (provider === 'google') {
            const update: Record<string, unknown> = {
              google_access_token: provider_token,
              google_token_expiry: tokenExpiry,
            }
            // Google only returns the refresh token on first consent — keep
            // the stored one if this sign-in didn't include a new one.
            if (provider_refresh_token) {
              update.google_refresh_token = provider_refresh_token
            }
            await admin.from('profiles').update(update).eq('id', user.id)
          } else {
            const update: Record<string, unknown> = {
              microsoft_access_token: provider_token,
              microsoft_token_expiry: tokenExpiry,
            }
            if (provider_refresh_token) {
              update.microsoft_refresh_token = provider_refresh_token
            }
            await admin.from('profiles').update(update).eq('id', user.id)
          }
        } catch {
          // Token storage is best-effort — auth still succeeds if this fails
        }
      }

      // Only allow relative redirects to prevent open-redirect attacks
      const safeNext = next.startsWith('/') ? next : '/pipeline'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}

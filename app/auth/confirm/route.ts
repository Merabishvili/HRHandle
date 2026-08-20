import { createClient } from '@/lib/supabase/server'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, localeFromUserMetadata } from '@/lib/i18n/locale-cookie'
import { NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/pipeline'

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      let redirectTarget: string
      if (next.startsWith('/')) {
        redirectTarget = `${origin}${next}`
      } else if (next.startsWith(origin)) {
        // Same-origin absolute URL coming from emailRedirectTo (invite flow)
        redirectTarget = next
      } else {
        redirectTarget = `${origin}/pipeline`
      }
      const response = NextResponse.redirect(redirectTarget)
      // Match the dashboard UI language to the user's saved preference (#7).
      const savedLocale = localeFromUserMetadata(data.user?.user_metadata)
      if (savedLocale) {
        response.cookies.set(LOCALE_COOKIE, savedLocale, {
          path: '/',
          maxAge: LOCALE_COOKIE_MAX_AGE,
          sameSite: 'lax',
        })
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      let redirectTarget: string
      if (next.startsWith('/')) {
        redirectTarget = `${origin}${next}`
      } else if (next.startsWith(origin)) {
        // Same-origin absolute URL coming from emailRedirectTo (invite flow)
        redirectTarget = next
      } else {
        redirectTarget = `${origin}/dashboard`
      }
      return NextResponse.redirect(redirectTarget)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}

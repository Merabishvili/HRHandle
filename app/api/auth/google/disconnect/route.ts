import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): this route mutates auth state but has no explicit
// CSRF token. Protection relies on (a) Supabase session cookies being
// SameSite=Lax (set by `@supabase/ssr`), so a cross-site POST does not include
// the session and `getUser()` returns null → redirect to login; and (b) the
// Next.js same-origin Server Action / route handler model. Do not loosen the
// Supabase cookie SameSite without re-evaluating.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  await supabase
    .from('profiles')
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
    })
    .eq('id', user.id)

  return NextResponse.redirect(new URL('/settings?google=disconnected', BASE))
}

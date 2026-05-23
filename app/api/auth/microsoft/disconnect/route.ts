import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// CSRF protection (S-013): see app/api/auth/google/disconnect/route.ts for the
// shared rationale — relies on SameSite=Lax Supabase session cookies and the
// Next.js same-origin route handler model.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  await supabase
    .from('profiles')
    .update({
      microsoft_access_token: null,
      microsoft_refresh_token: null,
      microsoft_token_expiry: null,
    })
    .eq('id', user.id)

  return NextResponse.redirect(new URL('/settings/integrations?microsoft=disconnected', BASE))
}

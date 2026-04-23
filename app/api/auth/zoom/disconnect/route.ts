import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', BASE))
  }

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ zoom_access_token: null, zoom_refresh_token: null, zoom_token_expiry: null })
    .eq('id', user.id)

  return NextResponse.redirect(new URL('/settings?zoom=disconnected', BASE))
}

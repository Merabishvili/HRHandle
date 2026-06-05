import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runOnboarding, type OnboardingOptions } from '@/lib/onboarding'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // DB-backed guard: if the user already has an org, onboarding is complete.
    // runOnboarding() performs the same check and is idempotent, so repeated
    // calls after initialization are cheap DB reads rather than writes.
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.organization_id) {
      return NextResponse.json({ success: true, alreadyInitialized: true })
    }

    // Optional body lets callers (e.g. an OAuth-aware client flow) supply the
    // names directly when user_metadata doesn't have them.
    const opts: OnboardingOptions = {}
    try {
      const body = (await request.json()) as { fullName?: unknown; companyName?: unknown }
      if (typeof body?.fullName === 'string') opts.fullName = body.fullName
      if (typeof body?.companyName === 'string') opts.companyName = body.companyName
    } catch {
      // No body / non-JSON body — treat as no overrides.
    }

    const result = await runOnboarding(user, opts)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, alreadyInitialized: result.alreadyInitialized })
  } catch {
    return NextResponse.json({ error: 'Unexpected error during onboarding' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runOnboarding } from '@/lib/onboarding'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = attempts.get(userId)

  if (!entry || now >= entry.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (entry.count >= MAX_ATTEMPTS) return true

  entry.count++
  return false
}

export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before retrying.' },
        { status: 429 }
      )
    }

    const result = await runOnboarding(user)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, alreadyInitialized: result.alreadyInitialized })
  } catch {
    return NextResponse.json({ error: 'Unexpected error during onboarding' }, { status: 500 })
  }
}

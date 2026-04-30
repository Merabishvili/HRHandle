import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  try {
    return (
      authHeader.length === expected.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    )
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc('expire_past_vacancies')

  if (error) {
    console.error('[cron] expire_past_vacancies failed:', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString() })
}

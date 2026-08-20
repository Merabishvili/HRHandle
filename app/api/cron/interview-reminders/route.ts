import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

// A daily run with a > 24h look-ahead so every next-day interview is caught once
// (reminder_sent_at prevents a second reminder if runs overlap).
const LOOKAHEAD_MS = 26 * 60 * 60 * 1000
const MAX_PER_RUN = 500

if (!process.env.CRON_SECRET) {
  console.warn(
    '[cron/interview-reminders] CRON_SECRET is not set — every request will 401. Set it on Vercel + .env.local to enable the cron.',
  )
}

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

/** PostgREST returns an embedded to-one relation as an object or (defensively) a
 * one-element array depending on the query shape — normalize to the first row. */
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

interface DueInterview {
  id: string
  organization_id: string
  interviewer_id: string | null
  candidates: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  vacancies: { title: string } | { title: string }[] | null
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const until = new Date(now.getTime() + LOOKAHEAD_MS)

  const { data: dueRaw, error } = await supabase
    .from('interviews')
    .select(
      'id, organization_id, interviewer_id, candidates ( first_name, last_name ), vacancies ( title )',
    )
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gt('scheduled_at', now.toISOString())
    .lte('scheduled_at', until.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (error) {
    console.error('[cron/interview-reminders] scan failed:', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const due = (dueRaw ?? []) as DueInterview[]
  // Fallback recipients for interviews with no assigned interviewer: the org's
  // owners/admins. Cached per org so we query each org at most once per run.
  const orgAdminsCache = new Map<string, string[]>()
  const orgAdmins = async (orgId: string): Promise<string[]> => {
    const cached = orgAdminsCache.get(orgId)
    if (cached) return cached
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'admin'])
      .eq('is_active', true)
    const ids = (data ?? []).map((r) => r.id as string)
    orgAdminsCache.set(orgId, ids)
    return ids
  }

  const remindedIds: string[] = []
  for (const iv of due) {
    const recipients = iv.interviewer_id ? [iv.interviewer_id] : await orgAdmins(iv.organization_id)
    if (recipients.length === 0) continue

    const cand = one(iv.candidates)
    const vac = one(iv.vacancies)
    const name = `${cand?.first_name ?? ''} ${cand?.last_name ?? ''}`.trim() || 'Candidate'

    await createOrgNotifications(iv.organization_id, recipients, {
      type: 'interview_reminder',
      title: `Upcoming interview: ${name}`,
      body: vac?.title ? `For ${vac.title}` : undefined,
      link: '/interviews',
      data: { name, ...(vac?.title ? { vacancy: vac.title } : {}) },
    })
    remindedIds.push(iv.id)
  }

  // Mark reminded so they're never reminded twice. Best-effort per-batch.
  if (remindedIds.length > 0) {
    const { error: updErr } = await supabase
      .from('interviews')
      .update({ reminder_sent_at: now.toISOString() })
      .in('id', remindedIds)
    if (updErr) {
      console.error('[cron/interview-reminders] mark-sent failed:', updErr.message)
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: now.toISOString(),
    scanned: due.length,
    reminded: remindedIds.length,
  })
}

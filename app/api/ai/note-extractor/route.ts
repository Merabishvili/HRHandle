import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  extractStructuredNotes,
  MAX_NOTES_LENGTH,
  MIN_NOTES_LENGTH,
} from '@/lib/ai/note-extractor'

export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_EXTRACT_REQUESTS_PER_ORG_PER_HOUR = 100

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= MAX_EXTRACT_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }
  entry.count++
  return true
}

const BodySchema = z.object({
  candidateId: z.string().uuid(),
  raw_notes: z.string().trim().min(MIN_NOTES_LENGTH).max(MAX_NOTES_LENGTH),
})

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    // Distinguish "too short" from generic bad-request so the UI can show a
    // useful message. Anything else is a programmer error.
    const firstIssue = parsed.error.issues[0]
    const tooShort = firstIssue?.path?.[0] === 'raw_notes' && firstIssue?.code === 'too_small'
    return NextResponse.json(
      { ok: false, reason: tooShort ? 'too_thin' : 'bad_request' },
      { status: tooShort ? 422 : 400 },
    )
  }

  if (!checkRateLimit(ctx.orgId)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
  }

  // Verify candidate belongs to org + pull a small bit of context (name +
  // most recent active applied vacancy title) to improve framing.
  const admin = createAdminClient()
  const { data: candidate, error: candErr } = await admin
    .from('candidates')
    .select(
      `id, first_name, last_name,
       applications(
         vacancies(title),
         created_at
       )`,
    )
    .eq('id', parsed.data.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (candErr) {
    console.error('[ai/note-extractor] candidate fetch failed:', candErr.message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
  if (!candidate) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  // Pick the most recent application's vacancy title for role context. Best-effort.
  type AppRow = { vacancies: { title: string } | { title: string }[] | null; created_at: string }
  const apps = (candidate.applications as AppRow[] | null) ?? []
  const sorted = [...apps].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const latestVacancy = sorted[0]?.vacancies
  const role_title = Array.isArray(latestVacancy)
    ? (latestVacancy[0]?.title ?? null)
    : (latestVacancy?.title ?? null)

  const contentLocale = await fetchOrgContentLocale(ctx.supabase, ctx.orgId)
  const result = await extractStructuredNotes({
    candidate_first_name: candidate.first_name as string,
    candidate_last_name: candidate.last_name as string,
    role_title,
    raw_notes: parsed.data.raw_notes,
  }, contentLocale)

  // Audit log: feature + length only. The notes content itself is never logged.
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: parsed.data.candidateId,
    action: 'ai_assist',
    message: 'Interview notes structured',
    details: {
      feature: 'note_extractor',
      success: result.ok,
      reason: result.ok ? null : result.reason,
      raw_notes_length: parsed.data.raw_notes.length,
    },
  })

  if (!result.ok) {
    const status =
      result.reason === 'too_thin'
        ? 422
        : result.reason === 'timeout'
          ? 504
          : result.reason === 'no_key'
            ? 503
            : 500
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result)
}

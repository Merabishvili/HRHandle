import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import { summarizeCandidate } from '@/lib/ai/candidate-summary'

// fra1 mirrors parse-cv — Google's API firewall blocks the default iad1 region.
export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_SUMMARY_REQUESTS_PER_ORG_PER_HOUR = 100

// In-memory rate-limit store, same shape as parse-cv (S-005 tradeoff). Per-org
// here rather than per-IP because this is an authenticated endpoint.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= MAX_SUMMARY_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }

  entry.count++
  return true
}

const BodySchema = z.object({
  candidateId: z.string().uuid(),
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
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
  }

  if (!checkRateLimit(ctx.orgId)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
  }

  // Fetch the candidate scoped to the user's org. The admin client is used
  // for the joined experience/education read because RLS on those tables
  // doesn't allow a join from the regular client across all candidates.
  const admin = createAdminClient()
  const { data: candidate, error: candErr } = await admin
    .from('candidates')
    .select(
      `id, first_name, last_name, current_position, current_company, location,
       years_of_experience, languages,
       candidate_experience(company, title, start_date, end_date, is_current),
       candidate_education(institution, degree, field_of_study)`,
    )
    .eq('id', parsed.data.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (candErr) {
    console.error('[ai/candidate-summary] candidate fetch failed:', candErr.message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
  if (!candidate) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  const result = await summarizeCandidate({
    first_name: candidate.first_name as string,
    last_name: candidate.last_name as string,
    current_position: (candidate.current_position as string | null) ?? null,
    current_company: (candidate.current_company as string | null) ?? null,
    location: (candidate.location as string | null) ?? null,
    years_of_experience: (candidate.years_of_experience as number | null) ?? null,
    languages: Array.isArray(candidate.languages)
      ? (candidate.languages as string[])
      : [],
    experience: Array.isArray(candidate.candidate_experience)
      ? (candidate.candidate_experience as Array<{
          company: string | null
          title: string | null
          start_date: string | null
          end_date: string | null
          is_current: boolean
        }>)
      : [],
    education: Array.isArray(candidate.candidate_education)
      ? (candidate.candidate_education as Array<{
          institution: string | null
          degree: string | null
          field_of_study: string | null
        }>)
      : [],
  })

  // Audit log entry for the EU AI Act "logging and traceability" obligation.
  // Records that an AI summary was requested for this candidate; the summary
  // content itself is NOT stored (it lives only in the recruiter's session
  // unless they explicitly "Save as note").
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: parsed.data.candidateId,
    action: 'ai_assist',
    message: 'Candidate summary requested',
    details: {
      feature: 'candidate_summary',
      success: result.ok,
      reason: result.ok ? null : result.reason,
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

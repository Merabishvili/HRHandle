import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  draftCandidateEmail,
  EMAIL_TYPES,
  EMAIL_MODES,
  type EmailType,
  type EmailMode,
} from '@/lib/ai/email-drafter'

export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_ED_REQUESTS_PER_ORG_PER_HOUR = 100

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= MAX_ED_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }
  entry.count++
  return true
}

const BodySchema = z.object({
  candidateId: z.string().uuid(),
  vacancyId: z.string().uuid().nullable().optional(),
  type: z.enum(EMAIL_TYPES),
  mode: z.enum(EMAIL_MODES),
  draft: z.string().trim().max(4000).nullable().optional(),
  additional_context: z.string().trim().max(1000).nullable().optional(),
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

  const admin = createAdminClient()

  // Candidate must belong to this org. We only need first_name for the prompt
  // — email/phone/LinkedIn/DOB are NOT sent to Gemini.
  const { data: candidate, error: cErr } = await admin
    .from('candidates')
    .select('id, first_name')
    .eq('id', parsed.data.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (cErr) {
    console.error('[ai/email-drafter] candidate fetch failed:', cErr.message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
  if (!candidate) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  // Optional vacancy lookup — for role context in the email.
  let role_title: string | null = null
  if (parsed.data.vacancyId) {
    const { data: vacancy } = await admin
      .from('vacancies')
      .select('id, title')
      .eq('id', parsed.data.vacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .maybeSingle()
    role_title = (vacancy?.title as string | undefined) ?? null
  }

  // Sender first name comes from the recruiter's own profile (full_name first word).
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.userId)
    .maybeSingle()
  const sender_first_name =
    ((profile?.full_name as string | null) ?? '').trim().split(/\s+/)[0] || null

  const result = await draftCandidateEmail({
    type: parsed.data.type as EmailType,
    mode: parsed.data.mode as EmailMode,
    candidate_first_name: (candidate.first_name as string) ?? '',
    role_title,
    sender_first_name,
    draft: parsed.data.draft ?? null,
    additional_context: parsed.data.additional_context ?? null,
  })

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: parsed.data.candidateId,
    action: 'ai_assist',
    message: 'Candidate email drafted',
    details: {
      feature: 'email_drafter',
      email_type: parsed.data.type,
      mode: parsed.data.mode,
      vacancy_id: parsed.data.vacancyId ?? null,
      success: result.ok,
      reason: result.ok ? null : result.reason,
      has_additional_context: !!parsed.data.additional_context,
      draft_chars: parsed.data.draft?.length ?? 0,
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

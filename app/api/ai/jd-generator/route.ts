import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { writeAuditLog } from '@/lib/audit-log'
import {
  generateJobDescriptionSection,
  type JdSection,
} from '@/lib/ai/jd-generator'

// fra1 mirrors candidate-summary + parse-cv — Google's API firewall blocks
// the default iad1 region.
export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_JD_REQUESTS_PER_ORG_PER_HOUR = 100

// In-memory rate-limit store, same shape as candidate-summary. Per-org.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= MAX_JD_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }

  entry.count++
  return true
}

const BodySchema = z.object({
  section: z.enum(['description', 'responsibilities', 'requirements']),
  title: z.string().trim().min(2, 'Title is required').max(200),
  department: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(100).nullable().optional(),
  employment_type: z
    .enum(['full_time', 'part_time', 'contract', 'internship'])
    .nullable()
    .optional(),
  sector_name: z.string().trim().max(100).nullable().optional(),
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

  const contentLocale = await fetchOrgContentLocale(ctx.supabase, ctx.orgId)
  const result = await generateJobDescriptionSection(
    {
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      employment_type: parsed.data.employment_type ?? null,
      sector_name: parsed.data.sector_name ?? null,
      additional_context: parsed.data.additional_context ?? null,
    },
    parsed.data.section as JdSection,
    contentLocale,
  )

  // EU AI Act traceability — log that an AI invocation happened. The
  // generated text itself is NOT logged (it would balloon activity_log
  // and add no compliance value).
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: null, // pre-creation: no vacancy row exists yet
    action: 'ai_assist',
    message: 'JD section generated',
    details: {
      feature: 'jd_generator',
      section: parsed.data.section,
      success: result.ok,
      reason: result.ok ? null : result.reason,
      has_additional_context: !!parsed.data.additional_context,
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

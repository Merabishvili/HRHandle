import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { writeAuditLog } from '@/lib/audit-log'
import { checkInclusiveLanguage } from '@/lib/ai/bias-check'

export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_BIAS_REQUESTS_PER_ORG_PER_HOUR = 100

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= MAX_BIAS_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }
  entry.count++
  return true
}

const BodySchema = z
  .object({
    description: z.string().trim().max(10000).nullable().optional(),
    responsibilities: z.string().trim().max(10000).nullable().optional(),
    requirements: z.string().trim().max(10000).nullable().optional(),
  })
  .refine(
    (val) =>
      (val.description?.length ?? 0) +
        (val.responsibilities?.length ?? 0) +
        (val.requirements?.length ?? 0) >
      0,
    { message: 'At least one field must be non-empty' },
  )

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
  const result = await checkInclusiveLanguage({
    description: parsed.data.description ?? null,
    responsibilities: parsed.data.responsibilities ?? null,
    requirements: parsed.data.requirements ?? null,
  }, contentLocale)

  // Audit log: feature + findings count. The findings themselves contain
  // verbatim JD snippets which would balloon the log without adding compliance
  // value — keep them out. The count alone shows the feature is being used.
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: null, // pre-creation: feature runs against form state before save
    action: 'ai_assist',
    message: 'Inclusive-language check run',
    details: {
      feature: 'bias_check',
      success: result.ok,
      reason: result.ok ? null : result.reason,
      findings_count: result.ok ? result.findings.length : 0,
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

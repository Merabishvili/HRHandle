import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/actions'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  suggestAssessmentItems,
  type AssessmentSuggesterInput,
} from '@/lib/ai/assessment-suggester'

export const preferredRegion = 'fra1'
export const maxDuration = 60

const MAX_AS_REQUESTS_PER_ORG_PER_HOUR = 100

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= MAX_AS_REQUESTS_PER_ORG_PER_HOUR) {
    return false
  }
  entry.count++
  return true
}

// Two shapes: an existing vacancy (the vacancy page), or raw JD text (the
// create-vacancy wizard, where no vacancy exists yet — suggestions are
// returned but nothing is persisted).
// Criteria already on the scorecard, so the model returns only NEW suggestions.
const ExistingSkills = z.array(z.string().trim().max(200)).max(50).optional()

const VacancyBody = z.object({
  vacancyId: z.string().uuid(),
  additional_context: z.string().trim().max(1000).nullable().optional(),
  existing_skills: ExistingSkills,
})
const RawBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  responsibilities: z.string().max(5000).nullable().optional(),
  requirements: z.string().max(5000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  employment_type: z
    .enum(['full_time', 'part_time', 'contract', 'internship'])
    .nullable()
    .optional(),
  sector_name: z.string().max(100).nullable().optional(),
  additional_context: z.string().trim().max(1000).nullable().optional(),
  existing_skills: ExistingSkills,
})
const BodySchema = z.union([VacancyBody, RawBody])

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

  let input: AssessmentSuggesterInput
  let auditVacancyId: string | null = null

  if ('vacancyId' in parsed.data) {
    const admin = createAdminClient()
    const { data: vacancy, error: vErr } = await admin
      .from('vacancies')
      .select(
        `id, title, description, responsibilities, requirements,
         department, location, employment_type,
         sectors(name)`,
      )
      .eq('id', parsed.data.vacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (vErr) {
      console.error('[ai/assessment-suggester] vacancy fetch failed:', vErr.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }
    if (!vacancy) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    type SectorJoin = { name: string } | { name: string }[] | null
    const sectorJoin = vacancy.sectors as SectorJoin
    const sector_name = Array.isArray(sectorJoin)
      ? (sectorJoin[0]?.name ?? null)
      : (sectorJoin?.name ?? null)

    input = {
      title: vacancy.title as string,
      description: (vacancy.description as string | null) ?? null,
      responsibilities: (vacancy.responsibilities as string | null) ?? null,
      requirements: (vacancy.requirements as string | null) ?? null,
      department: (vacancy.department as string | null) ?? null,
      location: (vacancy.location as string | null) ?? null,
      employment_type:
        (vacancy.employment_type as
          | 'full_time'
          | 'part_time'
          | 'contract'
          | 'internship'
          | null) ?? null,
      sector_name,
      additional_context: parsed.data.additional_context ?? null,
      existing_skills: parsed.data.existing_skills ?? null,
    }
    auditVacancyId = parsed.data.vacancyId
  } else {
    // Raw JD text from the wizard — nothing to fetch or persist.
    input = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      responsibilities: parsed.data.responsibilities ?? null,
      requirements: parsed.data.requirements ?? null,
      department: parsed.data.department ?? null,
      location: parsed.data.location ?? null,
      employment_type: parsed.data.employment_type ?? null,
      sector_name: parsed.data.sector_name ?? null,
      additional_context: parsed.data.additional_context ?? null,
      existing_skills: parsed.data.existing_skills ?? null,
    }
  }

  const contentLocale = await fetchOrgContentLocale(ctx.supabase, ctx.orgId)
  const result = await suggestAssessmentItems(input, contentLocale)

  if (auditVacancyId) {
    void writeAuditLog({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'vacancy',
      entityId: auditVacancyId,
      action: 'ai_assist',
      message: 'Assessment suggestions generated',
      details: {
        feature: 'assessment_suggester',
        success: result.ok,
        reason: result.ok ? null : result.reason,
        skills_count: result.ok ? result.suggestions.skills.length : 0,
        prompts_count: result.ok ? result.suggestions.prompts.length : 0,
      },
    })
  }

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

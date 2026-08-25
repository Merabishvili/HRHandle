'use server'

import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { getAuthContext, type ActionResult } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrgNotifications } from './notifications'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import {
  sanitizeForFitAnalysis,
  type SanitizedFitInput,
  type RawFitInput,
  type FitExperience,
  type FitEducation,
} from '@/lib/ai/cv-sanitizer'
import { runFitAnalysis, FIT_PROMPT_VERSION, type FitCriterionSpec, type FitRunResult } from '@/lib/ai/fit-analysis'
import { canEnableAiFit } from '@/lib/ai/fit-geofence'
import { resolveOrgContentLocale } from '@/lib/i18n/org-locale'
import type { Locale } from '@/lib/i18n/locales'
import type { AiFitAnalysis, FitAssessment } from '@/lib/types/ai-fit'

/** Advisory cap — matches the spec's 100 analyses/org/month. */
const MAX_ANALYSES_PER_ORG_PER_MONTH = 100

/** Hard deadline for the background run. Must stay below the route's
 * `maxDuration` (60s) so we always mark the row terminal before Vercel kills
 * the function — otherwise a pending row would spin forever (#1). */
const PROCESS_DEADLINE_MS = 50_000

/**
 * Request an AI Fit Analysis for an application. Advisory-only. Enforced
 * guardrails: org opt-in + EU acknowledgement, monthly cap, sanitization
 * (protected fields never reach the model), append-only provenance, audit log.
 *
 * ASYNC (#1): the model call used to run inline and block the request for the
 * whole retry budget, which Vercel killed → "temporarily unavailable". We now
 * insert a `pending` row, run the model in the background via `after()`, and
 * flip the row to completed/failed + fire an in-app notification when done. The
 * UI polls the row and shows "generating…" meanwhile. Fail-soft throughout.
 */
export async function requestAiFitAnalysis(applicationId: string): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations('aiFitErr')
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: t('notAuthenticated') }

  // ── Opt-in + geofencing gate ───────────────────────────────────────────────
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('ai_fit_enabled, ai_fit_eu_acknowledged, billing_country, default_content_locale, enabled_content_locales')
    .eq('id', ctx.orgId)
    .single()
  if (!org?.ai_fit_enabled) {
    return { success: false, error: t('notEnabled') }
  }
  if (!canEnableAiFit(org.billing_country, !!org.ai_fit_eu_acknowledged)) {
    return { success: false, error: t('euAck') }
  }

  // ── Monthly cap ────────────────────────────────────────────────────────────
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  // Exclude `failed` rows — a transient Gemini 503 that never produced a result
  // shouldn't burn the org's quota, otherwise auto-retries would eat the cap (#1).
  const { count: usedThisMonth } = await ctx.supabase
    .from('ai_fit_analyses')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .neq('status', 'failed')
    .gte('created_at', monthStart.toISOString())
  if ((usedThisMonth ?? 0) >= MAX_ANALYSES_PER_ORG_PER_MONTH) {
    return { success: false, error: t('monthlyCap') }
  }

  // ── Load inputs (org-scoped via RLS) ───────────────────────────────────────
  const { data: app } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!app) return { success: false, error: t('applicationNotFound') }

  const [{ data: candidate }, { data: questions }, { data: experience }, { data: education }] =
    await Promise.all([
      ctx.supabase
        .from('candidates')
        .select('first_name, last_name, years_of_experience, languages')
        .eq('id', app.candidate_id)
        .single(),
      ctx.supabase
        .from('vacancy_questions')
        .select('label, must_have, type')
        .eq('vacancy_id', app.vacancy_id)
        .order('sort_order', { ascending: true }),
      ctx.supabase
        .from('candidate_experience')
        .select('company, title, start_date, end_date, is_current, description')
        .eq('candidate_id', app.candidate_id),
      ctx.supabase
        .from('candidate_education')
        .select('institution, degree, field_of_study, start_year, end_year')
        .eq('candidate_id', app.candidate_id),
    ])

  const criteria: FitCriterionSpec[] = (questions ?? []).map((q) => ({
    name: q.label as string,
    must_have: !!q.must_have,
  }))
  if (criteria.length === 0) {
    return { success: false, error: t('noCriteria') }
  }

  // Screening answers (job-relevant) for this application.
  const { data: answerRows } = await ctx.supabase
    .from('application_screening_answers')
    .select('answer_value, vacancy_screening_questions(label)')
    .eq('application_id', applicationId)
  const screeningAnswers = (answerRows ?? [])
    .map((r) => {
      const q = r.vacancy_screening_questions as { label: string } | { label: string }[] | null
      const label = Array.isArray(q) ? q[0]?.label : q?.label
      return label ? { label, answer: String(r.answer_value ?? '') } : null
    })
    .filter((a): a is { label: string; answer: string } => a !== null)

  const rawInput: RawFitInput = {
    firstName: candidate?.first_name ?? null,
    lastName: candidate?.last_name ?? null,
    yearsOfExperience: (candidate?.years_of_experience as number | null) ?? null,
    languages: Array.isArray(candidate?.languages) ? (candidate?.languages as string[]) : [],
    experience: (experience ?? []) as FitExperience[],
    education: (education ?? []) as FitEducation[],
    screeningAnswers,
  }
  const sanitized = sanitizeForFitAnalysis(rawInput)
  const cvSnapshotHash = createHash('sha256').update(JSON.stringify(sanitized)).digest('hex')

  // ── Insert a PENDING row (outputs filled later by the background run) ───────
  const { data: inserted, error: insErr } = await ctx.supabase
    .from('ai_fit_analyses')
    .insert({
      organization_id: ctx.orgId,
      application_id: applicationId,
      status: 'pending',
      criteria_snapshot: criteria,
      cv_snapshot_hash: cvSnapshotHash,
      redacted_categories: sanitized.redactedCategories,
      screening_answers_snapshot: screeningAnswers,
      prompt_version: FIT_PROMPT_VERSION,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    console.error('[ai-fit] pending insert failed:', insErr?.message)
    return { success: false, error: t('saveFailed') }
  }

  const candidateName = [candidate?.first_name, candidate?.last_name].filter(Boolean).join(' ').trim()
  const locale = resolveOrgContentLocale(org)

  // Run the model AFTER the response is sent — the client gets an immediate
  // "requested" acknowledgement and polls the row for the result.
  after(() =>
    processFitAnalysis({
      analysisId: inserted.id,
      orgId: ctx.orgId,
      userId: ctx.userId,
      applicationId,
      candidateId: app.candidate_id,
      candidateName: candidateName || 'Candidate',
      sanitized,
      criteria,
      locale,
    }),
  )

  return { success: true, data: { id: inserted.id } }
}

/**
 * Background worker for a pending analysis (scheduled via `after()`). Runs the
 * model, updates the row to completed/failed, writes the audit log, and — on
 * success — fires an in-app notification so the requester is alerted even if
 * they navigated away. Uses the admin client because the request's auth context
 * is gone once the response has been sent. Never throws.
 */
async function processFitAnalysis(args: {
  analysisId: string
  orgId: string
  userId: string
  applicationId: string
  candidateId: string
  candidateName: string
  sanitized: SanitizedFitInput
  criteria: FitCriterionSpec[]
  locale: Locale
}): Promise<void> {
  const { analysisId, orgId, userId, applicationId, candidateId, candidateName, sanitized, criteria, locale } = args
  const admin = createAdminClient()
  try {
    // Hard overall deadline: Vercel kills the function at 60s, which would leave
    // the row stuck 'pending' forever. Race the model run against ~50s so we
    // always write a terminal status before the kill (#1).
    const result = await Promise.race([
      runFitAnalysis(sanitized, criteria, locale),
      new Promise<FitRunResult>((resolve) =>
        setTimeout(() => resolve({ ok: false, reason: 'timeout' }), PROCESS_DEADLINE_MS),
      ),
    ])

    if (!result.ok) {
      await admin
        .from('ai_fit_analyses')
        .update({ status: 'failed', error_reason: result.reason })
        .eq('id', analysisId)
        .eq('organization_id', orgId)
      void writeAuditLog({
        orgId,
        userId,
        entityType: 'application',
        entityId: applicationId,
        action: 'ai_fit_invoked',
        message: `AI fit analysis failed (${result.reason})`,
        details: { feature: 'ai_fit', ok: false, reason: result.reason, analysis_id: analysisId },
      })
      return
    }

    const { analysis } = result
    await admin
      .from('ai_fit_analyses')
      .update({
        status: 'completed',
        meets_count: analysis.meets_count,
        must_have_total: analysis.must_have_total,
        confidence: analysis.confidence,
        rendered_analysis: analysis,
        model_name: result.modelName,
        raw_response: result.rawResponse,
      })
      .eq('id', analysisId)
      .eq('organization_id', orgId)

    void writeAuditLog({
      orgId,
      userId,
      entityType: 'application',
      entityId: applicationId,
      action: 'ai_fit_invoked',
      message: `AI fit analysis generated (${analysis.meets_count}/${analysis.must_have_total} must-haves)`,
      details: { feature: 'ai_fit', analysis_id: analysisId, model: result.modelName, prompt_version: FIT_PROMPT_VERSION, redacted: sanitized.redactedCategories },
    })

    // Alert the requester (bell + localized at display time via `data`).
    void createOrgNotifications(orgId, [userId], {
      type: 'ai_fit_ready',
      title: `AI fit analysis ready — ${candidateName}`,
      body: 'View the candidate to see the results.',
      link: `/candidates/${candidateId}`,
      data: { name: candidateName },
    })
  } catch (err) {
    console.error('[ai-fit] background run failed:', err)
    await admin
      .from('ai_fit_analyses')
      .update({ status: 'failed', error_reason: 'failed' })
      .eq('id', analysisId)
      .eq('organization_id', orgId)
  }
}

const ANALYSIS_COLUMNS =
  'id, application_id, status, error_reason, meets_count, must_have_total, confidence, rendered_analysis, redacted_categories, model_name, model_version, prompt_version, assessment, assessment_reason, assessed_by, assessed_at, created_by, created_at'

/** Latest analysis for an application (org-scoped), or null. */
export async function getAiFitAnalysis(applicationId: string): Promise<ActionResult<AiFitAnalysis | null>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  const { data } = await ctx.supabase
    .from('ai_fit_analyses')
    .select(ANALYSIS_COLUMNS)
    .eq('application_id', applicationId)
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { success: true, data: (data as unknown as AiFitAnalysis | null) ?? null }
}

/**
 * Owner-only opt-in toggle for AI Fit Analysis (Wave 3.1). Enabling requires an
 * explicit acknowledgement of the advisory / EU-AI-Act framing (Guardrail 2),
 * which also satisfies the EU geofence in {@link canEnableAiFit}. Records
 * who / when and writes an audit trail.
 */
export async function setAiFitEnabled(
  enabled: boolean,
  acknowledged: boolean,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only the owner can change AI Fit Analysis settings.' }
  }
  if (enabled && !acknowledged) {
    return { success: false, error: 'Please acknowledge how AI Fit Analysis is used before enabling it.' }
  }

  const update = enabled
    ? {
        ai_fit_enabled: true,
        ai_fit_enabled_at: new Date().toISOString(),
        ai_fit_enabled_by: ctx.userId,
        ai_fit_eu_acknowledged: true,
      }
    : { ai_fit_enabled: false }

  const { error } = await ctx.supabase.from('organizations').update(update).eq('id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to update AI Fit Analysis settings.' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'organization',
    entityId: ctx.orgId,
    action: enabled ? 'ai_fit_enabled' : 'ai_fit_disabled',
    message: enabled ? 'Enabled AI Fit Analysis' : 'Disabled AI Fit Analysis',
    details: { feature: 'ai_fit', acknowledged: enabled },
  })
  revalidatePath('/settings/organization')
  return { success: true, data: undefined }
}

/**
 * Record the recruiter's mandatory assessment (Agree / Override) of an analysis
 * — EU AI Act Art. 14 human oversight. Override requires a reason.
 */
export async function submitFitAssessment(
  analysisId: string,
  assessment: FitAssessment,
  reason: string | null,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (assessment === 'override' && !reason?.trim()) {
    return { success: false, error: 'A reason is required to override the AI analysis.' }
  }

  const { data: row } = await ctx.supabase
    .from('ai_fit_analyses')
    .select('id, application_id')
    .eq('id', analysisId)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!row) return { success: false, error: 'Analysis not found' }

  const { error } = await ctx.supabase
    .from('ai_fit_analyses')
    .update({
      assessment,
      assessment_reason: assessment === 'override' ? reason!.trim() : null,
      assessed_by: ctx.userId,
      assessed_at: new Date().toISOString(),
    })
    .eq('id', analysisId)
    .eq('organization_id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to record your assessment.' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'application',
    entityId: row.application_id as string,
    action: assessment === 'agree' ? 'ai_fit_agreed' : 'ai_fit_overridden',
    message: assessment === 'agree' ? 'Agreed with AI fit analysis' : 'Overrode AI fit analysis',
    details: { feature: 'ai_fit', analysis_id: analysisId, has_reason: !!reason?.trim() },
  })
  return { success: true, data: undefined }
}

export interface AiFitOversight {
  usedThisMonth: number
  monthlyCap: number
  agreeCount: number
  overrideCount: number
  pendingCount: number
  recentOverrides: {
    id: string
    reason: string | null
    assessed_at: string | null
    meets_count: number
    must_have_total: number
  }[]
}

/**
 * Admin-only bias-oversight surface for AI Fit Analysis (Settings → Data). Shows
 * this month's usage vs the cap, the agree / override / pending split, and the
 * log of overrides with reasons — the signal a reviewer watches for skew. No
 * candidate PII: overrides are keyed by analysis id + the factual meets counts.
 */
export async function getAiFitOversight(): Promise<ActionResult<AiFitOversight>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Only owners and admins can view AI oversight.' }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const base = () => ctx.supabase.from('ai_fit_analyses').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.orgId)

  const [{ count: usedThisMonth }, { count: agreeCount }, { count: overrideCount }, { count: pendingCount }, { data: overrides }] =
    await Promise.all([
      base().gte('created_at', monthStart.toISOString()),
      base().eq('assessment', 'agree'),
      base().eq('assessment', 'override'),
      base().is('assessment', null),
      ctx.supabase
        .from('ai_fit_analyses')
        .select('id, assessment_reason, assessed_at, meets_count, must_have_total')
        .eq('organization_id', ctx.orgId)
        .eq('assessment', 'override')
        .order('assessed_at', { ascending: false })
        .limit(50),
    ])

  return {
    success: true,
    data: {
      usedThisMonth: usedThisMonth ?? 0,
      monthlyCap: MAX_ANALYSES_PER_ORG_PER_MONTH,
      agreeCount: agreeCount ?? 0,
      overrideCount: overrideCount ?? 0,
      pendingCount: pendingCount ?? 0,
      recentOverrides: (overrides ?? []).map((o) => ({
        id: o.id as string,
        reason: (o.assessment_reason as string | null) ?? null,
        assessed_at: (o.assessed_at as string | null) ?? null,
        meets_count: (o.meets_count as number | null) ?? 0,
        must_have_total: (o.must_have_total as number | null) ?? 0,
      })),
    },
  }
}

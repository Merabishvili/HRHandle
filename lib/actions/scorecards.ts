'use server'

import { revalidatePath } from 'next/cache'

import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  projectScorecard,
  type ScorecardAnswer,
  type ScorecardQuestion,
  type ScorecardView,
} from '@/lib/scorecards/projection'

export interface ScorecardShareState {
  /** Public URL the recruiter copies to share. `null` when no token has
   * been generated yet (or after revoke). */
  shareUrl: string | null
  shareToken: string | null
  /** When the token was first generated for this evaluation. */
  sharedAt: string | null
  /** When the token was most recently revoked. Cleared on re-share. */
  revokedAt: string | null
  sharedByName: string | null
}

interface ScorecardEvalRow {
  id: string
  application_id: string
  candidate_id: string
  vacancy_id: string
  organization_id: string
  scorecard_token: string | null
  scorecard_revoked_at: string | null
  shared_by: string | null
  shared_at: string | null
}

/** Resolve the evaluation tied to an application and verify that the caller
 * can manage its scorecard share. Authors of the evaluation OR org
 * owners/admins are allowed. Returns the evaluation row or an error. */
async function authorizedEvaluationFor(
  applicationId: string,
): Promise<
  | { ok: true; ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>; row: ScorecardEvalRow }
  | { ok: false; error: string }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { ok: false, error: 'Not authenticated' }

  const { data: row } = await ctx.supabase
    .from('candidate_evaluations')
    .select(
      `id, application_id, candidate_id, vacancy_id, organization_id,
       scorecard_token, scorecard_revoked_at, shared_by, shared_at`,
    )
    .eq('application_id', applicationId)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!row) return { ok: false, error: 'Evaluation not found' }

  if (!isOrgAdmin(ctx.role)) {
    return { ok: false, error: 'Only owners and admins can share scorecards.' }
  }

  return { ok: true, ctx, row: row as ScorecardEvalRow }
}

function buildShareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/scorecard/${token}`
}

/** Lazy generation of the scorecard token. Returns the existing token if
 * present; otherwise generates and persists one, and writes a
 * `scorecard_shared` audit row the first time. Calling this after a
 * revoke generates a new token (the old one is gone permanently). */
export async function getOrCreateScorecardToken(
  applicationId: string,
): Promise<ActionResult<ScorecardShareState>> {
  const authz = await authorizedEvaluationFor(applicationId)
  if (!authz.ok) return { success: false, error: authz.error }
  const { ctx, row } = authz

  if (row.scorecard_token) {
    return {
      success: true,
      data: {
        shareUrl: buildShareUrl(row.scorecard_token),
        shareToken: row.scorecard_token,
        sharedAt: row.shared_at,
        revokedAt: row.scorecard_revoked_at,
        sharedByName: row.shared_by
          ? (await displayNameFor(ctx.supabase, row.shared_by))
          : null,
      },
    }
  }

  // Generate + persist a token; clear any prior revoke timestamp. shared_by
  // and shared_at are stable: re-share after revoke preserves whoever first
  // cleared this evaluation to leave the workspace, so the public page's
  // attribution doesn't shift around. Only set them the first time.
  const token = crypto.randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()
  const isFirstShare = row.shared_at === null
  const updatePayload: Record<string, unknown> = {
    scorecard_token: token,
    scorecard_revoked_at: null,
  }
  if (isFirstShare) {
    updatePayload.shared_by = ctx.userId
    updatePayload.shared_at = now
  }

  const { error: updateErr } = await ctx.supabase
    .from('candidate_evaluations')
    .update(updatePayload)
    .eq('id', row.id)
    .eq('organization_id', ctx.orgId)
  if (updateErr) {
    console.error('[scorecards] generate token failed:', updateErr.message)
    return { success: false, error: 'Failed to generate share link' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate_evaluation',
    entityId: row.id,
    action: 'scorecard_shared',
    message: 'scorecard share link generated',
    details: { application_id: row.application_id },
  })

  revalidatePath(`/candidates/${row.candidate_id}`)
  const stableSharedAt = isFirstShare ? now : row.shared_at
  const stableSharedById = isFirstShare ? ctx.userId : row.shared_by
  return {
    success: true,
    data: {
      shareUrl: buildShareUrl(token),
      shareToken: token,
      sharedAt: stableSharedAt,
      revokedAt: null,
      sharedByName: stableSharedById
        ? await displayNameFor(ctx.supabase, stableSharedById)
        : null,
    },
  }
}

/** Destroy the current token. Old links 404 immediately. The
 * `scorecard_revoked_at` timestamp is preserved so the share dialog can
 * show "Revoked on …" the next time it opens. */
export async function revokeScorecardToken(
  applicationId: string,
): Promise<ActionResult<ScorecardShareState>> {
  const authz = await authorizedEvaluationFor(applicationId)
  if (!authz.ok) return { success: false, error: authz.error }
  const { ctx, row } = authz

  if (!row.scorecard_token) {
    // Idempotent: nothing to revoke.
    return {
      success: true,
      data: {
        shareUrl: null,
        shareToken: null,
        sharedAt: row.shared_at,
        revokedAt: row.scorecard_revoked_at,
        sharedByName: row.shared_by
          ? (await displayNameFor(ctx.supabase, row.shared_by))
          : null,
      },
    }
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await ctx.supabase
    .from('candidate_evaluations')
    .update({
      scorecard_token: null,
      scorecard_revoked_at: now,
    })
    .eq('id', row.id)
    .eq('organization_id', ctx.orgId)
  if (updateErr) {
    console.error('[scorecards] revoke failed:', updateErr.message)
    return { success: false, error: 'Failed to revoke share link' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate_evaluation',
    entityId: row.id,
    action: 'scorecard_revoked',
    message: 'scorecard share link revoked',
    details: { application_id: row.application_id },
  })

  revalidatePath(`/candidates/${row.candidate_id}`)
  return {
    success: true,
    data: {
      shareUrl: null,
      shareToken: null,
      sharedAt: row.shared_at,
      revokedAt: now,
      sharedByName: row.shared_by
        ? (await displayNameFor(ctx.supabase, row.shared_by))
        : null,
    },
  }
}

/** Read the current share state without mutating. Used by the share dialog
 * on open so the UI can show "Last shared on …" / "Revoked …" without
 * generating a fresh token until the recruiter clicks Copy. */
export async function getScorecardShareState(
  applicationId: string,
): Promise<ActionResult<ScorecardShareState>> {
  const authz = await authorizedEvaluationFor(applicationId)
  if (!authz.ok) return { success: false, error: authz.error }
  const { ctx, row } = authz

  return {
    success: true,
    data: {
      shareUrl: row.scorecard_token ? buildShareUrl(row.scorecard_token) : null,
      shareToken: row.scorecard_token,
      sharedAt: row.shared_at,
      revokedAt: row.scorecard_revoked_at,
      sharedByName: row.shared_by
        ? (await displayNameFor(ctx.supabase, row.shared_by))
        : null,
    },
  }
}

export interface PublicScorecard {
  candidate_full_name: string
  role_title: string
  organization_name: string
  shared_by_name: string | null
  shared_at: string | null
  view: ScorecardView
}

/** Public read of a scorecard via its token. No auth — token is the
 * credential. Mirrors the G-016/G-018 risk model. Returns 404-shaped
 * failures (no row, soft-deleted parents, revoked token) without leaking
 * which one occurred. */
export async function getScorecardByToken(
  token: string,
): Promise<ActionResult<PublicScorecard>> {
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return { success: false, error: 'Not found' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('candidate_evaluations')
    .select(
      `id, organization_id, application_id, candidate_id, vacancy_id, score,
       shared_by, shared_at, scorecard_token,
       candidates ( first_name, last_name, deleted_at ),
       vacancies ( title, deleted_at ),
       organizations ( name, deleted_at ),
       applications ( deleted_at )`,
    )
    .eq('scorecard_token', token)
    .maybeSingle()
  if (!row) return { success: false, error: 'Not found' }

  type CandidateJoin =
    | { first_name: string; last_name: string; deleted_at: string | null }
    | { first_name: string; last_name: string; deleted_at: string | null }[]
    | null
  type VacancyJoin =
    | { title: string; deleted_at: string | null }
    | { title: string; deleted_at: string | null }[]
    | null
  type OrgJoin =
    | { name: string; deleted_at: string | null }
    | { name: string; deleted_at: string | null }[]
    | null
  type AppJoin =
    | { deleted_at: string | null }
    | { deleted_at: string | null }[]
    | null

  const unwrap = <T,>(v: T | T[] | null): T | null =>
    v === null ? null : Array.isArray(v) ? v[0] ?? null : v

  const candidate = unwrap(row.candidates as CandidateJoin)
  const vacancy = unwrap(row.vacancies as VacancyJoin)
  const org = unwrap(row.organizations as OrgJoin)
  const application = unwrap(row.applications as AppJoin)

  if (!candidate || candidate.deleted_at) return { success: false, error: 'Not found' }
  if (!vacancy || vacancy.deleted_at) return { success: false, error: 'Not found' }
  if (!org || org.deleted_at) return { success: false, error: 'Not found' }
  if (!application || application.deleted_at) return { success: false, error: 'Not found' }

  // Fetch the vacancy's questions + this evaluation's answers in parallel.
  const [{ data: rawQuestions }, { data: rawAnswers }, sharedByName] = await Promise.all([
    admin
      .from('vacancy_questions')
      .select('id, label, type, sort_order')
      .eq('vacancy_id', row.vacancy_id as string)
      .order('sort_order', { ascending: true }),
    admin
      .from('candidate_evaluation_answers')
      .select('question_id, text_value, score_value')
      .eq('evaluation_id', row.id as string),
    row.shared_by ? displayNameFor(admin, row.shared_by as string) : Promise.resolve(null),
  ])

  const view = projectScorecard({
    overallScore: typeof row.score === 'number' ? (row.score as number) : null,
    questions: (rawQuestions ?? []) as ScorecardQuestion[],
    answers: (rawAnswers ?? []) as ScorecardAnswer[],
  })

  const candidateFullName = `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim()

  return {
    success: true,
    data: {
      candidate_full_name: candidateFullName || 'Candidate',
      role_title: vacancy.title,
      organization_name: org.name,
      shared_by_name: sharedByName,
      shared_at: (row.shared_at as string | null) ?? null,
      view,
    },
  }
}

// Tiny helper used by all four actions above to look up a profile's display
// name without each caller wiring its own .select. Returns null when the
// profile was deleted (e.g. the recruiter who shared has left the org).
async function displayNameFor(
  // We accept either the user's RLS-scoped client or the admin client — the
  // shape is the same and the lookup is org-scoped via profiles.id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await client
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return null
    return (data.full_name as string | null) || (data.email as string | null) || null
  } catch {
    return null
  }
}

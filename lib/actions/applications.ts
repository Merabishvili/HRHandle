'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendApplicationRejectionEmail, sendApplicationStatusChangedEmail } from '@/lib/email'
import { shouldEmailForTransition } from '@/lib/applications-status-emails'
import { writeAuditLog } from '@/lib/audit-log'
import { createOrgNotifications } from '@/lib/actions/notifications'
import {
  MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE,
  APPLICATION_STATUS,
  ACTIVE_APPLICATION_STATUS_CODES,
  CANDIDATE_STATUS,
} from '@/lib/types/constants'

/**
 * A-003: PostgREST's relation embedding sometimes returns a single row as an
 * object and sometimes wrapped in an array (depending on whether the FK is
 * `!inner` and on PostgREST's join inference). This predicate normalises both
 * shapes to a single object so callers can branchlessly compare `.code`.
 */
function unwrapStatusRelation<T extends { code: string }>(
  rel: T | T[] | null | undefined
): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Fetch application to get candidate_id + previous status code + sort_order for audit log
  // and the auto-email forward-direction gate.
  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, status_id, application_statuses ( code, sort_order )')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  type StatusJoin =
    | { code: string; sort_order: number }
    | { code: string; sort_order: number }[]
    | null
  const beforeJoin = application.application_statuses as StatusJoin
  const beforeRow = Array.isArray(beforeJoin) ? beforeJoin[0] : beforeJoin
  const beforeCode = beforeRow?.code
  const beforeSortOrder = beforeRow?.sort_order ?? null

  const { error } = await ctx.supabase
    .from('applications')
    .update({
      status_id: newStatusId,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update application status' }

  // Sync candidate general_status based on application pipeline stage
  const { data: newStatus } = await ctx.supabase
    .from('application_statuses')
    .select('code, sort_order')
    .eq('id', newStatusId)
    .single()

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'application',
    entityId: applicationId,
    action: 'status_changed',
    message:
      beforeCode && newStatus?.code
        ? `${beforeCode} → ${newStatus.code}`
        : `status changed to ${newStatus?.code ?? 'unknown'}`,
    details: {
      candidate_id: application.candidate_id,
      before: beforeCode ?? null,
      after: newStatus?.code ?? null,
    },
  })

  if (newStatus) {
    const { data: candidateStatuses } = await ctx.supabase
      .from('candidate_statuses')
      .select('id, code')

    const statusMap = new Map((candidateStatuses || []).map((s) => [s.code, s.id]))

    if (newStatus.code === APPLICATION_STATUS.HIRED) {
      // Moving to Hired → set candidate status to Hired
      const hiredId = statusMap.get(CANDIDATE_STATUS.HIRED)
      if (hiredId) {
        await ctx.supabase
          .from('candidates')
          .update({ general_status_id: hiredId })
          .eq('id', application.candidate_id)
          .eq('organization_id', ctx.orgId)
      }

      // Notify org owners + admins that a candidate was hired (the meaningful
      // stage transition — other stages would be too noisy to ping on every
      // change). Best-effort: failures are logged but never break the action.
      try {
        const [{ data: candidate }, { data: appWithVacancy }, { data: members }] =
          await Promise.all([
            ctx.supabase
              .from('candidates')
              .select('first_name, last_name')
              .eq('id', application.candidate_id)
              .single(),
            ctx.supabase
              .from('applications')
              .select('vacancies ( id, title )')
              .eq('id', applicationId)
              .single(),
            ctx.supabase
              .from('profiles')
              .select('id')
              .eq('organization_id', ctx.orgId)
              .in('role', ['owner', 'admin'])
              .neq('id', ctx.userId),
          ])

        type VacJoin = { id: string; title: string } | { id: string; title: string }[] | null
        const vac = appWithVacancy?.vacancies as VacJoin
        const vacRow = Array.isArray(vac) ? vac[0] : vac

        const recipientIds = (members || []).map((m) => m.id)
        if (recipientIds.length > 0 && candidate) {
          await createOrgNotifications(ctx.orgId, recipientIds, {
            type: 'candidate_hired',
            title: `Candidate hired: ${candidate.first_name} ${candidate.last_name}`,
            body: vacRow?.title ? `For ${vacRow.title}` : undefined,
            link: vacRow?.id ? `/vacancies/${vacRow.id}?tab=applications` : undefined,
          })
        }
      } catch (err) {
        console.error('[applications] candidate-hired notification failed:', err)
      }
    } else {
      // Moving away from any stage → check if candidate has any other hired application
      const { data: hiredApps } = await ctx.supabase
        .from('applications')
        .select('id, application_statuses!inner(code)')
        .eq('candidate_id', application.candidate_id)
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .neq('id', applicationId)

      type AppWithStatus = { id: string; application_statuses: { code: string } | { code: string }[] | null }
      const hasOtherHired = (hiredApps as AppWithStatus[] || []).some(
        (a) => unwrapStatusRelation(a.application_statuses)?.code === APPLICATION_STATUS.HIRED
      )

      if (!hasOtherHired) {
        const activeId = statusMap.get(CANDIDATE_STATUS.ACTIVE)
        if (activeId) {
          // Only revert if currently hired (don't override archived)
          const { data: candidate } = await ctx.supabase
            .from('candidates')
            .select('general_status_id')
            .eq('id', application.candidate_id)
            .eq('organization_id', ctx.orgId)
            .single()

          const currentCode = (candidateStatuses || []).find(
            (s) => s.id === candidate?.general_status_id
          )?.code

          if (currentCode === CANDIDATE_STATUS.HIRED) {
            await ctx.supabase
              .from('candidates')
              .update({ general_status_id: activeId })
              .eq('id', application.candidate_id)
              .eq('organization_id', ctx.orgId)
          }
        }
      }
    }
  }

  // ── G-017: Auto-email the candidate on a forward move into screening or
  // interview, if the org has opted in by saving a template row for that type.
  // Wrapped end-to-end in try/catch — email failures must never block the
  // status update or surface as a user-facing error.
  try {
    const target = shouldEmailForTransition(
      beforeCode,
      newStatus?.code,
      beforeSortOrder,
      newStatus?.sort_order ?? null,
    )

    if (target) {
      // Lookup the org's template row. If absent, opt-IN is OFF → skip.
      const { data: templateRow } = await ctx.supabase
        .from('email_templates')
        .select('subject, body, is_enabled')
        .eq('organization_id', ctx.orgId)
        .eq('template_type', target.type)
        .maybeSingle()

      if (templateRow && templateRow.is_enabled !== false) {
        const [{ data: candidate }, { data: appJoin }, { data: org }] = await Promise.all([
          ctx.supabase
            .from('candidates')
            .select('first_name, last_name, email')
            .eq('id', application.candidate_id)
            .single(),
          ctx.supabase
            .from('applications')
            .select('public_token, vacancies ( title )')
            .eq('id', applicationId)
            .single(),
          ctx.supabase
            .from('organizations')
            .select('name')
            .eq('id', ctx.orgId)
            .single(),
        ])

        type VacJoin = { title: string } | { title: string }[] | null
        const vac = appJoin?.vacancies as VacJoin
        const vacancyTitle = (Array.isArray(vac) ? vac[0]?.title : vac?.title) ?? 'the role'
        const publicToken = (appJoin?.public_token as string | null | undefined) ?? null

        if (candidate?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          await sendApplicationStatusChangedEmail({
            to: candidate.email,
            candidateName: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() || 'there',
            vacancyTitle,
            organizationName: org?.name || 'the company',
            stage: target.stage,
            statusUrl: publicToken ? `${baseUrl}/status/${publicToken}` : undefined,
            customSubject: templateRow.subject || undefined,
            customBody: templateRow.body || undefined,
          })

          void writeAuditLog({
            orgId: ctx.orgId,
            userId: ctx.userId,
            entityType: 'application',
            entityId: applicationId,
            action: 'status_change_email_sent',
            message: `auto-email sent for transition to ${newStatus?.code ?? target.stage}`,
            details: {
              candidate_id: application.candidate_id,
              stage: target.stage,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('[applications] status-change auto-email failed:', err)
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

export async function createApplication(input: {
  candidateId: string
  vacancyId: string
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Only active candidates can be linked to a vacancy
  const { data: candidateCheck } = await ctx.supabase
    .from('candidates')
    .select('general_status_id, candidate_statuses(code)')
    .eq('id', input.candidateId)
    .eq('organization_id', ctx.orgId)
    .single()

  const statusesRaw = candidateCheck?.candidate_statuses as { code: string }[] | { code: string } | null
  const generalCode = Array.isArray(statusesRaw) ? statusesRaw[0]?.code : (statusesRaw as { code: string } | null)?.code
  if (generalCode && generalCode !== CANDIDATE_STATUS.ACTIVE) {
    return { success: false, error: 'Only active candidates can be added to a vacancy.' }
  }

  // Resolve active application status IDs
  const { data: activeStatusesRaw } = await ctx.supabase
    .from('application_statuses')
    .select('id, code')
    .in('code', ACTIVE_APPLICATION_STATUS_CODES)

  const activeStatusIds = (activeStatusesRaw || []).map((s) => s.id)

  // Count existing active applications for this candidate
  const { count } = await ctx.supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', input.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .in('status_id', activeStatusIds)

  if ((count ?? 0) >= MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE) {
    return {
      success: false,
      error: `This candidate is already active on ${MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE} vacancies. Move one to Hired or Rejected, or archive it, before adding a new one.`,
    }
  }

  // Prevent duplicate application to the same vacancy
  const { data: existing } = await ctx.supabase
    .from('applications')
    .select('id')
    .eq('candidate_id', input.candidateId)
    .eq('vacancy_id', input.vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) return { success: false, error: 'This candidate is already being considered for this vacancy.' }

  // Get the "applied" status id
  const appliedStatus = (activeStatusesRaw || []).find((s) => s.code === APPLICATION_STATUS.APPLIED)
  if (!appliedStatus) return { success: false, error: 'Application status configuration missing.' }

  // public_token is the candidate-facing status page key (G-016) — generated
  // for every new application, including recruiter-added ones, so the link
  // exists if the recruiter chooses to share it.
  const publicToken = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await ctx.supabase
    .from('applications')
    .insert({
      candidate_id: input.candidateId,
      vacancy_id: input.vacancyId,
      organization_id: ctx.orgId,
      status_id: appliedStatus.id,
      applied_at: new Date().toISOString(),
      public_token: publicToken,
      source_type: 'manual',
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create application.' }

  revalidatePath(`/candidates/${input.candidateId}`)
  revalidatePath(`/vacancies/${input.vacancyId}`)
  return { success: true, data: { id: data.id } }
}

/** Candidate-side withdraw via the public status-page token (G-022). Token is
 * the credential — same risk model as G-016. Idempotent: a second call on an
 * already-withdrawn application is a no-op. Cancels any active offer so a
 * stale Accept button never re-appears on /offer/<token>. */
export async function withdrawApplicationByToken(
  token: string,
  reason: string | null = null,
): Promise<ActionResult<void>> {
  // Defensive token shape check before any DB hit.
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return { success: false, error: 'Invalid token' }
  }

  // Token-gated; bypass RLS deliberately, mirroring G-016 + G-018.
  const admin = createAdminClient()

  const { data: app, error: appErr } = await admin
    .from('applications')
    .select(
      `id, candidate_id, vacancy_id, status_id, organization_id, deleted_at,
       application_statuses ( code )`,
    )
    .eq('public_token', token)
    .maybeSingle()
  if (appErr) {
    console.error('[applications] withdraw lookup failed:', appErr.message)
    return { success: false, error: 'Failed to load application' }
  }
  if (!app || app.deleted_at) {
    return { success: false, error: 'Application not found' }
  }

  type StatusJoin = { code: string } | { code: string }[] | null
  const beforeJoin = app.application_statuses as StatusJoin
  const beforeCode = Array.isArray(beforeJoin) ? beforeJoin[0]?.code : beforeJoin?.code

  // Block self-withdraw from terminal states. `withdrawn` is a no-op success
  // so a double-submit on the candidate UI is harmless; the other terminals
  // (hired / rejected) are recruiter-decided and shouldn't be overridable.
  const TERMINAL: ReadonlySet<string> = new Set([
    APPLICATION_STATUS.HIRED,
    APPLICATION_STATUS.REJECTED,
  ])
  if (beforeCode === APPLICATION_STATUS.WITHDRAWN) {
    return { success: true, data: undefined }
  }
  if (beforeCode && TERMINAL.has(beforeCode)) {
    return {
      success: false,
      error: 'This application can no longer be withdrawn. Contact the recruiter directly.',
    }
  }

  // Resolve the withdrawn status id.
  const { data: withdrawnStatus } = await admin
    .from('application_statuses')
    .select('id')
    .eq('code', APPLICATION_STATUS.WITHDRAWN)
    .single()
  if (!withdrawnStatus) {
    return { success: false, error: 'Status configuration missing' }
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('applications')
    .update({
      status_id: withdrawnStatus.id,
      last_status_changed_at: now,
    })
    .eq('id', app.id as string)
    .eq('organization_id', app.organization_id as string)
  if (updateErr) {
    console.error('[applications] withdraw update failed:', updateErr.message)
    return { success: false, error: 'Failed to withdraw' }
  }

  // Cancel any active offer so the candidate doesn't accidentally accept one
  // after withdrawing the underlying application.
  const { data: liveOffers } = await admin
    .from('offers')
    .select('id')
    .eq('application_id', app.id as string)
    .eq('organization_id', app.organization_id as string)
    .is('deleted_at', null)
    .in('status', ['draft', 'sent'])
  const liveOfferIds = (liveOffers ?? []).map((o) => o.id as string)
  if (liveOfferIds.length > 0) {
    await admin
      .from('offers')
      .update({
        status: 'withdrawn',
        responded_at: now,
        updated_at: now,
      })
      .in('id', liveOfferIds)
  }

  void writeAuditLog({
    orgId: app.organization_id as string,
    userId: null,
    entityType: 'application',
    entityId: app.id as string,
    action: 'application_withdrawn',
    message: 'application withdrawn by candidate',
    details: {
      via: 'candidate_token',
      before: beforeCode ?? null,
      has_reason: !!reason,
      cancelled_offers: liveOfferIds.length,
    },
  })

  // Notify owners + admins (best-effort).
  try {
    const { data: members } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', app.organization_id as string)
      .in('role', ['owner', 'admin'])
    const recipientIds = (members ?? []).map((m) => m.id as string)
    if (recipientIds.length > 0) {
      await createOrgNotifications(app.organization_id as string, recipientIds, {
        type: 'application_withdrawn',
        title: 'A candidate withdrew their application',
        body: undefined,
        link: app.candidate_id ? `/candidates/${app.candidate_id as string}` : undefined,
      })
    }
  } catch (err) {
    console.error('[applications] withdraw notification failed:', err)
  }

  return { success: true, data: undefined }
}

export async function removeApplication(applicationId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('applications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to remove application' }

  revalidatePath('/vacancies/[id]', 'page')
  revalidatePath('/candidates/[id]', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

export async function rejectApplication(input: {
  applicationId: string
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
  customSubject?: string | null
  customBody?: string | null
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id, status_id')
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  const { error: updateError } = await ctx.supabase
    .from('applications')
    .update({
      status_id: input.statusId,
      rejection_reason_id: input.rejectionReasonId ?? null,
      rejection_template_id: input.templateId ?? null,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (updateError) return { success: false, error: 'Failed to update application status' }

  // Sync candidate general_status (rejected → keep as active unless hired)
  const { data: candidateStatuses } = await ctx.supabase
    .from('candidate_statuses')
    .select('id, code')

  const statusMap = new Map((candidateStatuses || []).map((s) => [s.code, s.id]))

  const { data: hiredApps } = await ctx.supabase
    .from('applications')
    .select('id, application_statuses!inner(code)')
    .eq('candidate_id', application.candidate_id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .neq('id', input.applicationId)

  type AppWithStatus = { id: string; application_statuses: { code: string } | { code: string }[] | null }
  const hasOtherHired = (hiredApps as AppWithStatus[] || []).some(
    (a) => unwrapStatusRelation(a.application_statuses)?.code === APPLICATION_STATUS.HIRED
  )

  if (!hasOtherHired) {
    const { data: candidate } = await ctx.supabase
      .from('candidates')
      .select('general_status_id')
      .eq('id', application.candidate_id)
      .single()

    const currentCode = (candidateStatuses || []).find(
      (s) => s.id === candidate?.general_status_id
    )?.code

    if (currentCode === CANDIDATE_STATUS.HIRED) {
      const activeId = statusMap.get(CANDIDATE_STATUS.ACTIVE)
      if (activeId) {
        await ctx.supabase
          .from('candidates')
          .update({ general_status_id: activeId })
          .eq('id', application.candidate_id)
          .eq('organization_id', ctx.orgId)
      }
    }
  }

  if (input.sendEmail) {
    try {
      const [{ data: candidateData }, { data: vacancyData }, { data: orgData }, { data: profileData }] =
        await Promise.all([
          ctx.supabase
            .from('candidates')
            .select('first_name, last_name, email')
            .eq('id', application.candidate_id)
            .eq('organization_id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('vacancies')
            .select('title')
            .eq('id', application.vacancy_id)
            .eq('organization_id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('organizations')
            .select('name')
            .eq('id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', ctx.userId)
            .single(),
        ])

      // Resolve subject/body: custom override > stored template > built-in default
      let finalSubject: string | undefined = input.customSubject ?? undefined
      let finalBody: string | undefined = input.customBody ?? undefined

      if ((!finalSubject || !finalBody) && input.templateId) {
        const { data: templateData } = await ctx.supabase
          .from('rejection_templates')
          .select('subject, body')
          .eq('id', input.templateId)
          .eq('organization_id', ctx.orgId)
          .single()
        if (templateData) {
          finalSubject = finalSubject ?? templateData.subject
          finalBody = finalBody ?? templateData.body
        }
      }

      if (candidateData?.email && vacancyData && orgData) {
        await sendApplicationRejectionEmail({
          to: candidateData.email,
          candidateName: `${candidateData.first_name} ${candidateData.last_name}`.trim(),
          vacancyTitle: vacancyData.title,
          organizationName: orgData.name,
          senderName: profileData?.full_name ?? orgData.name,
          senderEmail: profileData?.email ?? '',
          customSubject: finalSubject,
          customBody: finalBody,
        })
      }
    } catch (err) {
      // Email failure is non-fatal; status was already updated. Log so the
      // operator can investigate Resend / template / SMTP issues.
      console.error('[applications] rejection email send failed:', err)
    }
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

/**
 * Reject multiple applications in one batch — used by the bulk-action toolbar
 * on a vacancy's Candidates tab. Same per-row behaviour as `rejectApplication`
 * (status update, rejection_reason_id + rejection_template_id stamped on the
 * row, candidate's general status synced, optional templated email sent), just
 * iterated. Each application is processed independently, so a failure on one
 * does not block the rest — the caller receives counts of {succeeded, failed}.
 *
 * Implementation note: applications are processed serially rather than in
 * parallel, because the candidate_statuses join inside `rejectApplication`
 * fans out a handful of DB reads per call. At typical batch sizes (5-30
 * applications) the serial latency is fine and we keep the request pattern
 * predictable. If batch sizes grow into the hundreds, this is the obvious
 * place to switch to a chunked Promise.all.
 */
export async function rejectApplicationsBatch(input: {
  applicationIds: string[]
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
}): Promise<
  ActionResult<{ succeeded: number; failed: number; failures: { id: string; error: string }[] }>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (input.applicationIds.length === 0) {
    return { success: false, error: 'No applications selected' }
  }

  // De-duplicate the input — if the UI ever double-counts a selection, we
  // shouldn't double-process the rejection.
  const uniqueIds = Array.from(new Set(input.applicationIds))

  let succeeded = 0
  const failures: { id: string; error: string }[] = []

  for (const applicationId of uniqueIds) {
    const result = await rejectApplication({
      applicationId,
      statusId: input.statusId,
      rejectionReasonId: input.rejectionReasonId,
      templateId: input.templateId,
      sendEmail: input.sendEmail,
    })
    if (result.success) {
      succeeded++
    } else {
      failures.push({ id: applicationId, error: result.error })
    }
  }

  // Each rejectApplication call already revalidates the relevant paths, so
  // we don't add another revalidate here — that would just thrash the cache.
  return {
    success: true,
    data: { succeeded, failed: failures.length, failures },
  }
}

/** Defensive upper bound for one bulk-move call. With ~100ms per
 * updateApplicationStatus call (auth lookup + status update + audit log +
 * candidate-status sync + optional email), 50 rows ≈ 5s — sits comfortably
 * inside Vercel's serverless timeout. If batch sizes ever grow past this,
 * the obvious next step is to lift `getAuthContext` out of the per-row
 * call (mirrors the same future refactor sketched on `rejectApplicationsBatch`). */
const MAX_BULK_MOVE_BATCH = 50

export interface BulkMoveResult {
  moved: number
  skipped: number
  failed: number
  failures: { id: string; error: string }[]
}

/**
 * Bulk move multiple applications to a target status (G-024). Used by the
 * "Move to stage" dropdown on the vacancy applications toolbar — the
 * recruiter selects rows, picks a target stage, and we apply the same
 * per-row updateApplicationStatus path for each one so audit logging,
 * candidate-status sync, and the opt-in status-change auto-email all fire
 * without us re-implementing them.
 *
 * Per-row outcomes are classified:
 * - `moved`: the per-row updateApplicationStatus succeeded.
 * - `skipped`: the row was already at the target status — we detect this
 *   before calling the action so we don't generate noise audit rows for
 *   no-op changes.
 * - `failed`: the per-row call returned an error (RLS, stale state, etc).
 *
 * Rejection / withdrawn targets are blocked here because rejection has its
 * own dedicated `rejectApplicationsBatch` flow (with reason + template +
 * opt-in email selection) and `withdrawn` is candidate-initiated.
 */
export async function moveApplicationsBatch(input: {
  applicationIds: string[]
  targetStatusId: string
}): Promise<ActionResult<BulkMoveResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (input.applicationIds.length === 0) {
    return { success: false, error: 'No applications selected' }
  }
  if (input.applicationIds.length > MAX_BULK_MOVE_BATCH) {
    return {
      success: false,
      error: `Too many applications selected. Move at most ${MAX_BULK_MOVE_BATCH} at a time.`,
    }
  }

  // Verify the target status exists in this org's scope and isn't a
  // rejection / withdrawn target (each has its own flow).
  const { data: targetStatus } = await ctx.supabase
    .from('application_statuses')
    .select('code')
    .eq('id', input.targetStatusId)
    .single()
  if (!targetStatus) {
    return { success: false, error: 'Target status not found' }
  }
  if (
    targetStatus.code === APPLICATION_STATUS.REJECTED ||
    targetStatus.code === APPLICATION_STATUS.WITHDRAWN
  ) {
    return {
      success: false,
      error:
        targetStatus.code === APPLICATION_STATUS.REJECTED
          ? 'Use the Reject selected action for rejections.'
          : 'Candidates withdraw their own applications from the status page.',
    }
  }

  const uniqueIds = Array.from(new Set(input.applicationIds))

  // Skip rows that are already at the target status so we don't generate
  // a no-op audit row + (with opt-in) a duplicate auto-email. One small
  // lookup is faster than a per-row no-op write.
  const { data: currentStates } = await ctx.supabase
    .from('applications')
    .select('id, status_id')
    .in('id', uniqueIds)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
  const statusById = new Map(
    ((currentStates ?? []) as { id: string; status_id: string | null }[]).map((r) => [
      r.id,
      r.status_id,
    ]),
  )

  let moved = 0
  let skipped = 0
  const failures: { id: string; error: string }[] = []

  for (const applicationId of uniqueIds) {
    const existingStatusId = statusById.get(applicationId)
    if (existingStatusId === input.targetStatusId) {
      skipped++
      continue
    }
    if (existingStatusId === undefined) {
      // Row didn't come back in the lookup — already deleted, or RLS hid it.
      failures.push({ id: applicationId, error: 'Application not found' })
      continue
    }
    const result = await updateApplicationStatus(applicationId, input.targetStatusId)
    if (result.success) {
      moved++
    } else {
      failures.push({ id: applicationId, error: result.error })
    }
  }

  // updateApplicationStatus already revalidates the pipeline + candidates
  // routes per call, so no additional revalidatePath here.
  return {
    success: true,
    data: { moved, skipped, failed: failures.length, failures },
  }
}

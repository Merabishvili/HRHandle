import { notFound, redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import { createClient } from '@/lib/supabase/server'
import {
  getCandidateStatuses,
  getApplicationStatuses,
} from '@/lib/cache/lookups'
import type { ApplicationStatus } from '@/lib/types/application'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { toDisplayFullName } from '@/lib/format-name'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'
import type { ActivityItem } from '@/components/candidates/activity-feed'
import type { ActivityParams } from '@/lib/candidates/activity-i18n'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { localizeRejectionTemplateRow } from '@/lib/email-template-utils'
import { getRecentMerge } from '@/lib/actions/candidate-merge'
import { CandidateProfileShell } from '@/components/candidates/profile/profile-shell'
import type { OfferRow } from '@/components/offers/offer-panel'
import type { HistoryRow } from '@/components/candidates/profile/application-history'
import type { RepeatApplicantSummary } from '@/components/candidates/profile/repeat-applicant-banner'
import type { StageContextualBlockProps } from '@/components/candidates/profile/stage-contextual-block'

// AI Fit runs in the background via `after()` from the profile's server action
// (#1). Give that function room beyond the client response so the model call +
// row update can finish within one invocation.
export const maxDuration = 60

/**
 * Wave 2.3 candidate profile — rebuild per
 * `redesign/Candidate Profile A Refined.dc.html`. Headline additions over
 * the previous version:
 *
 *   1. Single outer card wrapping the whole working surface.
 *   2. Repeat-applicant banner (amber tile) when the candidate has prior
 *      closed applications. Surfaces a one-line summary + most-recent
 *      rejection reason without expanding history.
 *   3. Active vs closed split: live applications populate the
 *      ActiveApplicationSelector (single pill at the top of the body);
 *      closed ones live in the collapsible ApplicationHistory panel.
 *   4. Stage-contextual block: the same slot under the selector changes
 *      based on the selected application's current stage (Screening gate
 *      with knockout-data tiles → Interview state with scheduled
 *      interview + scorecard CTA → Offer state with build-offer CTA).
 *   5. Right rail: dedicated ACTIONS section (primary "Advance to {next}"
 *      + Schedule / Email / Reject), DETAILS section (consolidated
 *      key-value layout for salary, notice, location, timezone,
 *      languages, source, added), then CONTACT and custom fields below.
 *
 * Server component — data fetch only. All interactive state (selected
 * application, history-open) lives in `CandidateProfileShell`.
 *
 * Known gaps (tech-debt.md §2):
 *  - Screening recommendation + reason aren't persisted yet (Wave 2.5
 *    `candidate_evaluations.recommendation` + `reason` columns pending).
 *    For now the recommendation drives only the status transition.
 *  - "Build offer" CTA on the Offer-state block routes to the existing
 *    offer flow; design specifies an inline form to be added later.
 *  - Merge candidates dropdown item is rendered but disabled — the flow
 *    is a known unbuilt spec (audit `A-3`).
 */

interface CandidateRow {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  linkedin_profile_url: string | null
  current_company: string | null
  current_position: string | null
  location: string | null
  timezone: string | null
  languages: string[]
  salary_expectation: string | null
  notice_period: string | null
  source: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface PipelineStageJoinRow {
  id: string
  name: string
  type: 'standard' | 'review' | 'interview' | 'offer'
  is_terminal: boolean
}

interface ApplicationRow {
  id: string
  vacancy_id: string
  pipeline_stage_id: string | null
  applied_at: string
  updated_at: string
  last_status_changed_at: string | null
  pipeline_stages: PipelineStageJoinRow | PipelineStageJoinRow[] | null
}

interface InterviewRow {
  id: string
  application_id: string | null
  scheduled_at: string
  duration_minutes: number
  type: 'phone' | 'video' | 'onsite'
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  google_meet_link: string | null
  meeting_link: string | null
}

interface DocumentRow {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  document_type: string
  created_at: string
}

interface RawActivityRow {
  id: string
  candidate_id: string
  organization_id: string
  kind: string
  headline: string
  body: string | null
  meta: string | null
  actor_name: string | null
  created_at: string
  /** Structured localization params (present once the 20260820 view rebuild is
   * applied; absent before that → English headline fallback). */
  params?: Record<string, unknown> | null
}

const TERMINAL_CODES: ReadonlySet<ApplicationStatus['code']> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function computeYearsExp(entries: CandidateExperience[]): number | null {
  if (entries.length === 0) return null
  const earliest = entries.reduce<Date | null>((min, e) => {
    if (!e.start_date) return min
    const d = new Date(e.start_date)
    return !min || d < min ? d : min
  }, null)
  if (!earliest) return null
  return Math.max(0, Math.floor((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365)))
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) notFound()

  const organizationId = profile.organization_id

  // Wave 3.1 — is AI Fit Analysis enabled for this org? Reads gracefully
  // (returns false) if the column isn't migrated yet, so the card stays hidden.
  const { data: orgAiFit } = await supabase
    .from('organizations')
    .select('ai_fit_enabled')
    .eq('id', organizationId)
    .single()
  const aiFitEnabled = !!orgAiFit?.ai_fit_enabled

  const [
    { data: candidateRaw },
    _candidateStatusesRaw,
    appStatusesRaw,
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
  ] = await Promise.all([
    supabase
      .from('candidates')
      .select(`
        id, organization_id, first_name, last_name,
        email, phone, linkedin_profile_url,
        current_company, current_position,
        location, timezone, languages, salary_expectation, notice_period,
        source, created_at, updated_at, deleted_at
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single(),

    getCandidateStatuses(),
    getApplicationStatuses(),

    supabase
      .from('rejection_reasons')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),

    supabase
      .from('rejection_templates')
      .select('id, name, subject, body, reason_id')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
  ])

  const candidate = candidateRaw as CandidateRow | null
  if (!candidate) {
    // Merged-into redirect (A-3): an old ID for a row that was folded
    // into another candidate should land the user on the surviving
    // record, not 404. Only redirect inside the same org.
    const { data: mergedRow } = await supabase
      .from('candidates')
      .select('merged_into_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .not('merged_into_id', 'is', null)
      .maybeSingle()
    if (mergedRow?.merged_into_id) {
      redirect(`/candidates/${mergedRow.merged_into_id}`)
    }
    notFound()
  }

  const appStatuses = (appStatusesRaw || []) as ApplicationStatus[]
  const sortedActiveStages = [...appStatuses]
    .filter((s) => s.is_active && !TERMINAL_CODES.has(s.code))
    .sort((a, b) => a.sort_order - b.sort_order)
  const rejectedStatusId = appStatuses.find((s) => s.code === 'rejected')?.id ?? null

  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select(
      `id, vacancy_id, pipeline_stage_id, applied_at, updated_at, last_status_changed_at,
       pipeline_stages ( id, name, type, is_terminal )`,
    )
    .eq('organization_id', organizationId)
    .eq('candidate_id', id)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })

  const applications = (applicationsRaw || []) as ApplicationRow[]

  const vacancyIds = [...new Set(applications.map((a) => a.vacancy_id))]
  const vacancyMap = new Map<string, { id: string; title: string }>()
  if (vacancyIds.length > 0) {
    const { data: vacanciesRaw } = await supabase
      .from('vacancies')
      .select('id, title')
      .in('id', vacancyIds)
    for (const v of (vacanciesRaw || []) as { id: string; title: string }[]) {
      vacancyMap.set(v.id, v)
    }
  }

  // Wave 2.6 Slice 2c — Resolve each application's stage from the
  // per-vacancy `pipeline_stages` row joined on the application, then
  // bucket-map to the canonical code for outcome / terminal checks.
  // The display name uses the recruiter's custom stage name (e.g.
  // "HR Interview" / "Sourced") rather than the canonical bucket.
  function resolveStage(a: ApplicationRow) {
    const join = a.pipeline_stages
    const row = Array.isArray(join) ? join[0] : join
    if (!row) return null
    const canonical = mapPipelineStageToBucket({
      type: row.type,
      name: row.name,
      is_terminal: row.is_terminal,
    })
    return { id: row.id, name: row.name, code: canonical as ApplicationStatus['code'] }
  }

  // Partition into active (selector + contextual block) vs closed (history).
  // An application with no pipeline_stage yet (pipeline_stage_id NULL) still
  // belongs in the active list — fall back to the first active stage ("Applied")
  // instead of silently dropping it (that hid a whole linked vacancy).
  const fallbackStage = sortedActiveStages[0]
  const activeApplications = applications.flatMap((a) => {
    const stage =
      resolveStage(a) ??
      (fallbackStage
        ? { id: fallbackStage.id, name: fallbackStage.name, code: fallbackStage.code }
        : null)
    if (!stage || TERMINAL_CODES.has(stage.code)) return []
    const vacancy = vacancyMap.get(a.vacancy_id)
    if (!vacancy) return []
    return [{
      id: a.id,
      vacancyId: a.vacancy_id,
      vacancyTitle: vacancy.title,
      stage,
    }]
  })

  // History rows — pull rejection reason name where applicable.
  // Plus the furthest-reached-stage is approximated by the current stage
  // (which is the closed stage). A proper reached-stage would need an
  // audit-log lookup; tech-debt for now.
  const closedApps = applications
    .map((a) => {
      const status = resolveStage(a)
      if (!status || !TERMINAL_CODES.has(status.code)) return null
      const vacancy = vacancyMap.get(a.vacancy_id)
      if (!vacancy) return null
      return { app: a, status, vacancy }
    })
    .filter(
      (x): x is {
        app: ApplicationRow
        status: { id: string; name: string; code: ApplicationStatus['code'] }
        vacancy: { id: string; title: string }
      } => x !== null,
    )

  // Per-application reason — looked up from the most recent rejection
  // record. We do a single batch fetch then map.
  const rejectionReasonMap = new Map<string, string>()
  if (closedApps.length > 0) {
    const closedIds = closedApps.map((c) => c.app.id)
    const { data: rejectionRowsRaw } = await supabase
      .from('application_rejections')
      .select('application_id, rejection_reason_id')
      .in('application_id', closedIds)
    const rejectionRows = (rejectionRowsRaw ?? []) as {
      application_id: string
      rejection_reason_id: string | null
    }[]
    const reasonNameById = new Map(
      ((rejectionReasonsRaw ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
    )
    for (const r of rejectionRows) {
      if (r.rejection_reason_id) {
        const name = reasonNameById.get(r.rejection_reason_id)
        if (name) rejectionReasonMap.set(r.application_id, name)
      }
    }
  }

  const closedHistoryRows: HistoryRow[] = closedApps.map(({ app, status, vacancy }) => ({
    applicationId: app.id,
    vacancyTitle: vacancy.title,
    outcome: status.code as 'rejected' | 'withdrawn' | 'hired',
    reasonName: rejectionReasonMap.get(app.id) ?? null,
    closedAt: app.last_status_changed_at ?? app.updated_at,
    // Reached-stage approximation — not great, but acceptable until an
    // audit-log query gives us the actual stage history.
    reachedStageName: status.name,
  }))

  // Offers per active application → the offer-stage block shows a persistent
  // "Offer sent" summary (status, terms, actions) once one exists, instead of
  // leaving a bare create form behind after Save & send.
  const offersByApplication: Record<string, OfferRow[]> = {}
  if (activeApplications.length > 0) {
    const { data: offersRaw } = await supabase
      .from('offers')
      .select(
        'id, application_id, status, role_title, compensation_amount, compensation_currency, compensation_period, start_date, expiry_date, body, recruiter_message, public_token, sent_at, responded_at, decline_reason',
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('application_id', activeApplications.map((a) => a.id))
      .order('created_at', { ascending: false })
    for (const o of (offersRaw ?? []) as (OfferRow & { application_id: string })[]) {
      ;(offersByApplication[o.application_id] ??= []).push(o)
    }
  }

  // Repeat-applicant summary
  const rejectedCount = closedHistoryRows.filter((r) => r.outcome === 'rejected').length
  const withdrawnCount = closedHistoryRows.filter((r) => r.outcome === 'withdrawn').length
  const mostRecentClosed = closedHistoryRows[0] ?? null
  const repeatSummary: RepeatApplicantSummary = {
    totalClosed: closedHistoryRows.length,
    rejectedCount,
    withdrawnCount,
    mostRecent: mostRecentClosed && (mostRecentClosed.outcome === 'rejected' || mostRecentClosed.outcome === 'withdrawn')
      ? {
          vacancyTitle: mostRecentClosed.vacancyTitle,
          outcome: mostRecentClosed.outcome,
          closedAtRelative: formatDistanceToNow(new Date(mostRecentClosed.closedAt), {
            addSuffix: true,
          }),
          reasonName: mostRecentClosed.reasonName,
        }
      : null,
  }

  // Upcoming interview per active application
  const upcomingInterviewByApplication = new Map<
    string,
    StageContextualBlockProps['upcomingInterview']
  >()
  if (activeApplications.length > 0) {
    const { data: interviewsRaw } = await supabase
      .from('interviews')
      .select('id, application_id, scheduled_at, duration_minutes, type, status, google_meet_link, meeting_link')
      .eq('organization_id', organizationId)
      .eq('candidate_id', id)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
    const interviews = (interviewsRaw || []) as InterviewRow[]
    const now = new Date()
    for (const interview of interviews) {
      if (!interview.application_id) continue
      if (new Date(interview.scheduled_at) < now) continue
      // First upcoming per application wins (we sorted ascending)
      if (upcomingInterviewByApplication.has(interview.application_id)) continue
      upcomingInterviewByApplication.set(interview.application_id, {
        id: interview.id,
        type: interview.type,
        scheduledAt: interview.scheduled_at,
        durationMinutes: interview.duration_minutes,
        meetingLink: interview.google_meet_link || interview.meeting_link,
      })
    }
  }

  // Wave 2.5 Slice 2b — knockout-flagged screening answers per active
  // application. Surfaces on the Screening-stage block so the recruiter
  // sees which questions the candidate fell short on before they decide
  // whether to advance to interview.
  // ALL apply-form screening answers per application (not just knockout-flagged
  // ones) so the recruiter sees every question the candidate answered — e.g. a
  // "desired salary" answer that isn't a knockout was previously invisible
  // (#6). `isFlag` marks the ones that failed a knockout condition.
  const screeningAnswersByApplication = new Map<
    string,
    { questionLabel: string; answerValue: string | null; answerType: string; expectedAnswer: string | null; isFlag: boolean; sortOrder: number }[]
  >()
  if (activeApplications.length > 0) {
    const activeAppIds = activeApplications.map((a) => a.id)
    const { data: answersRaw } = await supabase
      .from('application_screening_answers')
      .select(
        'application_id, answer_value, is_knockout_flag, vacancy_screening_questions ( label, answer_type, knockout_answer, sort_order )',
      )
      .eq('organization_id', organizationId)
      .in('application_id', activeAppIds)

    type ScreeningQ = { label: string; answer_type: string | null; knockout_answer: string | null; sort_order: number | null }
    type ScreeningJoin = {
      application_id: string
      answer_value: string | null
      is_knockout_flag: boolean | null
      vacancy_screening_questions: ScreeningQ | ScreeningQ[] | null
    }
    for (const row of (answersRaw ?? []) as ScreeningJoin[]) {
      const qJoin = row.vacancy_screening_questions
      const q = Array.isArray(qJoin) ? qJoin[0] : qJoin
      if (!q) continue
      const existing = screeningAnswersByApplication.get(row.application_id) ?? []
      existing.push({
        questionLabel: q.label,
        answerValue: row.answer_value ?? null,
        answerType: q.answer_type ?? 'short_text',
        expectedAnswer: q.knockout_answer ?? null,
        isFlag: !!row.is_knockout_flag,
        sortOrder: q.sort_order ?? 0,
      })
      screeningAnswersByApplication.set(row.application_id, existing)
    }
    // Stable display order per the vacancy's question order.
    for (const list of screeningAnswersByApplication.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
  }

  // The current recruiter's OWN scorecard per active application, so it's
  // visible on the profile after submitting (was previously only re-openable in
  // the modal) (#N6). Reviewer-scoped — one row per (application, reviewer).
  const myEvaluationByApplication = new Map<
    string,
    { recommendation: string | null; score: number | null; submitted: boolean; reason: string | null }
  >()
  if (activeApplications.length > 0) {
    const { data: myEvalsRaw } = await supabase
      .from('candidate_evaluations')
      .select('application_id, recommendation, score, submitted, recommendation_reason')
      .eq('organization_id', organizationId)
      .eq('reviewer_id', user.id)
      .in('application_id', activeApplications.map((a) => a.id))
    for (const row of myEvalsRaw ?? []) {
      myEvaluationByApplication.set(row.application_id as string, {
        recommendation: (row.recommendation as string | null) ?? null,
        score: (row.score as number | null) ?? null,
        submitted: !!row.submitted,
        reason: (row.recommendation_reason as string | null) ?? null,
      })
    }
  }

  const [
    { data: experienceRaw },
    { data: educationRaw },
    { data: documentsRaw },
    customFieldGroups,
    customFieldValues,
  ] = await Promise.all([
    supabase.from('candidate_experience').select('*').eq('candidate_id', id).eq('organization_id', organizationId).order('start_date', { ascending: false, nullsFirst: false }),
    supabase.from('candidate_education').select('*').eq('candidate_id', id).eq('organization_id', organizationId).order('start_year', { ascending: false, nullsFirst: false }),
    supabase.from('candidate_documents').select('id, file_name, file_size, mime_type, document_type, created_at').eq('candidate_id', id).eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    getCustomFieldSchema('candidate'),
    getCustomFieldValues(id),
  ])

  const experienceEntries = (experienceRaw || []) as CandidateExperience[]
  const educationEntries = (educationRaw || []) as CandidateEducation[]
  const documents = (documentsRaw || []) as DocumentRow[]

  // `select('*')` (not an explicit column list) so the structured `params`
  // column added by 20260820_candidate_activity_i18n_params.sql rides along when
  // present and is simply absent pre-migration — the client renderer falls back
  // to the English `headline`, so this can't break before the view is rebuilt.
  const { data: activityRaw } = await supabase
    .from('candidate_activity')
    .select('*')
    .eq('candidate_id', id)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  const activityItems: ActivityItem[] = (activityRaw || []).map((r: RawActivityRow) => ({
    id: r.id,
    kind: r.kind as ActivityItem['kind'],
    headline: r.headline,
    body: r.body,
    meta: r.meta,
    actor_name: r.actor_name,
    created_at: r.created_at,
    params: (r.params ?? null) as ActivityParams | null,
  }))

  const yearsExp = computeYearsExp(experienceEntries)
  const headlineExp = experienceEntries[0]
    ? `${experienceEntries[0].title} at ${experienceEntries[0].company}`
    : null

  // Headline subtitle: "role at company · location · 12y · EN · KA · DE · RU"
  const subtitleParts = [
    headlineExp,
    candidate.location,
    yearsExp ? `${yearsExp}y` : null,
    ...candidate.languages,
  ].filter(Boolean) as string[]
  const headlineSubtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : null

  // A-3b — fetch the most recent un-reverted merge inside the 30-day
  // window so the profile shell can render the split-back banner. Best-
  // effort: failures fall back to no banner.
  const recentMergeRes = await getRecentMerge(candidate.id)
  const recentMerge = recentMergeRes.success ? recentMergeRes.data : null

  // Open/draft vacancies the candidate isn't already active on — feeds the
  // "Add to Vacancy" dialog (previously hardcoded to an empty list, so it
  // always claimed there were none).
  const activeVacancyIds = new Set(activeApplications.map((a) => a.vacancyId))
  const { data: openVacanciesRaw } = await supabase
    .from('vacancies')
    .select('id, title, department, vacancy_statuses ( code )')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  const availableVacancies = (
    (openVacanciesRaw ?? []) as {
      id: string
      title: string
      department: string | null
      vacancy_statuses: { code: string } | { code: string }[] | null
    }[]
  )
    .filter((v) => {
      const rel = Array.isArray(v.vacancy_statuses) ? v.vacancy_statuses[0] : v.vacancy_statuses
      return (rel?.code === 'open' || rel?.code === 'draft') && !activeVacancyIds.has(v.id)
    })
    .map((v) => ({ id: v.id, title: v.title, department: v.department }))

  // Prev/next paging (#2) — neighbours in the org-wide default list order
  // (newest first), independent of any list filters. Only ids are fetched.
  const { data: navRows } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  const navIds = (navRows ?? []).map((r) => r.id as string)
  const navIdx = navIds.indexOf(id)
  const prevCandidateId = navIdx > 0 ? navIds[navIdx - 1]! : null
  const nextCandidateId = navIdx >= 0 && navIdx < navIds.length - 1 ? navIds[navIdx + 1]! : null

  // Localize seeded default rejection templates so the reject-dialog preview
  // matches the (already-localized) email that gets sent (#3).
  const orgContentLocale = await fetchOrgContentLocale(supabase, organizationId)
  const rejectionTemplates = (rejectionTemplatesRaw ?? []).map((tpl) =>
    localizeRejectionTemplateRow(tpl, orgContentLocale),
  )

  return (
    <CandidateProfileShell
      aiFitEnabled={aiFitEnabled}
      prevCandidateId={prevCandidateId}
      nextCandidateId={nextCandidateId}
      candidate={{
        id: candidate.id,
        fullName: toDisplayFullName(candidate.first_name, candidate.last_name),
        initials: initials(candidate.first_name, candidate.last_name),
        headlineSubtitle,
        location: candidate.location,
        timezone: candidate.timezone,
        languages: candidate.languages ?? [],
        yearsExperience: yearsExp,
        salaryExpectation: candidate.salary_expectation,
        noticePeriod: candidate.notice_period,
        source: candidate.source,
        addedAt: candidate.created_at,
        email: candidate.email,
        phone: candidate.phone,
        linkedinUrl: candidate.linkedin_profile_url,
        currentCompany: candidate.current_company,
        currentPosition: candidate.current_position,
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
      }}
      organizationId={organizationId}
      currentUserId={user.id}
      currentUserName={profile.full_name ?? null}
      availableVacancies={availableVacancies}
      activeApplications={activeApplications}
      offersByApplication={offersByApplication}
      closedHistoryRows={closedHistoryRows}
      repeatSummary={repeatSummary}
      activeStages={sortedActiveStages.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      upcomingInterviewByApplication={upcomingInterviewByApplication}
      screeningAnswersByApplication={screeningAnswersByApplication}
      myEvaluationByApplication={myEvaluationByApplication}
      rejectionReasons={rejectionReasonsRaw ?? []}
      rejectionTemplates={rejectionTemplates}
      rejectedStatusId={rejectedStatusId}
      experienceEntries={experienceEntries}
      educationEntries={educationEntries}
      activityItems={activityItems}
      documents={documents}
      customFieldGroups={customFieldGroups}
      customFieldValues={customFieldValues}
      recentMerge={recentMerge}
    />
  )
}

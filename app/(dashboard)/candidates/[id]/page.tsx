import { notFound, redirect } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

import { createClient } from '@/lib/supabase/server'
import {
  getCandidateStatuses,
  getApplicationStatuses,
} from '@/lib/cache/lookups'
import type { ApplicationStatus } from '@/lib/types/application'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'
import type { ActivityItem } from '@/components/candidates/activity-feed'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { CandidateProfileShell } from '@/components/candidates/profile/profile-shell'
import type { HistoryRow } from '@/components/candidates/profile/application-history'
import type { RepeatApplicantSummary } from '@/components/candidates/profile/repeat-applicant-banner'
import type { StageContextualBlockProps } from '@/components/candidates/profile/stage-contextual-block'

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
  location: string | null
  timezone: string | null
  languages: string[]
  salary_expectation: string | null
  notice_period: string | null
  source: string | null
  general_status_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface ApplicationRow {
  id: string
  vacancy_id: string
  status_id: string | null
  applied_at: string
  updated_at: string
  last_status_changed_at: string | null
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
        location, timezone, languages, salary_expectation, notice_period,
        source, general_status_id, created_at, updated_at, deleted_at
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
  if (!candidate) notFound()

  const appStatuses = (appStatusesRaw || []) as ApplicationStatus[]
  const sortedActiveStages = [...appStatuses]
    .filter((s) => s.is_active && !TERMINAL_CODES.has(s.code))
    .sort((a, b) => a.sort_order - b.sort_order)
  const rejectedStatusId = appStatuses.find((s) => s.code === 'rejected')?.id ?? null

  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select('id, vacancy_id, status_id, applied_at, updated_at, last_status_changed_at')
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

  const statusById = new Map(appStatuses.map((s) => [s.id, s]))

  // Partition into active (selector + contextual block) vs closed (history)
  const activeApplications = applications.flatMap((a) => {
    const stage = a.status_id ? statusById.get(a.status_id) : null
    if (!stage || TERMINAL_CODES.has(stage.code)) return []
    const vacancy = vacancyMap.get(a.vacancy_id)
    if (!vacancy) return []
    return [{
      id: a.id,
      vacancyId: a.vacancy_id,
      vacancyTitle: vacancy.title,
      stage: { id: stage.id, code: stage.code, name: stage.name },
    }]
  })

  // History rows — pull rejection reason name where applicable.
  // Plus the furthest-reached-stage is approximated by the current stage
  // (which is the closed stage). A proper reached-stage would need an
  // audit-log lookup; tech-debt for now.
  const closedApps = applications
    .map((a) => {
      const status = a.status_id ? statusById.get(a.status_id) : null
      if (!status || !TERMINAL_CODES.has(status.code)) return null
      const vacancy = vacancyMap.get(a.vacancy_id)
      if (!vacancy) return null
      return { app: a, status, vacancy }
    })
    .filter((x): x is { app: ApplicationRow; status: ApplicationStatus; vacancy: { id: string; title: string } } => x !== null)

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

  const { data: activityRaw } = await supabase
    .from('candidate_activity')
    .select('id, candidate_id, organization_id, kind, headline, body, meta, actor_name, created_at')
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

  // Custom-field rail items — flatten short-typed fields for the dense rail.
  // Long_text fields are deliberately excluded — they belong in the
  // "Additional information" card under the contextual block, not in the
  // dense rail.
  const railCustomFields: { label: string; value: string | null }[] = []
  for (const group of customFieldGroups) {
    for (const field of group.fields) {
      if (field.field_type === 'long_text') continue
      const valueRow = customFieldValues.find((v) => v.field_id === field.id)
      let value: string | null = null
      if (valueRow) {
        if (valueRow.value_text) value = valueRow.value_text
        else if (valueRow.value_option) value = valueRow.value_option
        else if (valueRow.value_number !== null && valueRow.value_number !== undefined) {
          value = String(valueRow.value_number)
        } else if (valueRow.value_boolean === true) value = 'Yes'
        else if (valueRow.value_boolean === false) value = 'No'
      }
      railCustomFields.push({ label: field.name, value })
    }
  }

  return (
    <CandidateProfileShell
      candidate={{
        id: candidate.id,
        fullName: `${candidate.first_name} ${candidate.last_name}`.trim(),
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
        createdAt: candidate.created_at,
        updatedAt: candidate.updated_at,
      }}
      organizationId={organizationId}
      currentUserId={user.id}
      currentUserName={profile.full_name ?? null}
      activeApplications={activeApplications}
      closedHistoryRows={closedHistoryRows}
      repeatSummary={repeatSummary}
      activeStages={sortedActiveStages.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      upcomingInterviewByApplication={upcomingInterviewByApplication}
      rejectionReasons={rejectionReasonsRaw ?? []}
      rejectionTemplates={rejectionTemplatesRaw ?? []}
      rejectedStatusId={rejectedStatusId}
      experienceEntries={experienceEntries}
      educationEntries={educationEntries}
      activityItems={activityItems}
      documents={documents}
      customFieldGroups={customFieldGroups}
      customFieldValues={customFieldValues}
      railCustomFields={railCustomFields}
    />
  )
}

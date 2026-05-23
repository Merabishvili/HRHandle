import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCandidateStatuses, getApplicationStatuses, getVacancyStatuses } from '@/lib/cache/lookups'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Pencil, CalendarPlus, Calendar } from 'lucide-react'
import { StatusPill } from '@/components/ui/status-pill'
import { SummaryStrip } from '@/components/candidates/summary-strip'
import { ContactCard } from '@/components/candidates/contact-card'
import { MetadataFooter } from '@/components/candidates/metadata-footer'
import { CandidateStatusSelect } from '@/components/candidates/candidate-status-select'
import { CandidateDocuments } from '@/components/candidates/candidate-documents'
import { AddApplicationDialog } from '@/components/candidates/add-application-dialog'
import { DeleteCandidateButton } from '@/components/candidates/delete-candidate-button'
import { CandidateApplicationsList } from '@/components/candidates/candidate-applications-list'
import { ExperienceSection } from '@/components/candidates/experience-section'
import { EducationSection } from '@/components/candidates/education-section'
import { ActivityFeed } from '@/components/candidates/activity-feed'
import { CustomFieldsDisplay } from '@/components/custom-fields/custom-fields-display'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { format } from 'date-fns'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'
import type { ActivityItem } from '@/components/candidates/activity-feed'

// ── Types ─────────────────────────────────────────────────────────────────────

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

import type {
  CandidateStatusOption,
  ApplicationStatusOption as AppStatusRow,
} from '@/lib/types/database'

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  status_id: string | null
  applied_at: string
  updated_at: string
  created_by: string | null
}

interface VacancyOption {
  id: string
  title: string
  department: string | null
  location: string | null
}

interface InterviewRow {
  id: string
  candidate_id: string
  vacancy_id: string
  application_id: string | null
  interviewer_id: string | null
  scheduled_at: string
  duration_minutes: number
  type: 'phone' | 'video' | 'onsite'
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  google_meet_link: string | null
  meeting_link: string | null
  created_at: string
  profiles: { full_name: string | null }[] | null
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

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
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) notFound()

  const organizationId = profile.organization_id

  const [
    { data: candidateRaw },
    candidateStatusesRaw,
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

  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusOption[]
  const currentStatus = candidate.general_status_id
    ? candidateStatuses.find((s) => s.id === candidate.general_status_id) ?? null
    : null

  const appStatusMap = new Map(((appStatusesRaw || []) as AppStatusRow[]).map((s) => [s.id, s]))

  // Applications + vacancies
  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id, status_id, applied_at, updated_at, created_by')
    .eq('organization_id', organizationId)
    .eq('candidate_id', id)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })

  const applications = (applicationsRaw || []) as ApplicationRow[]

  const vacancyIds = [...new Set(applications.map((a) => a.vacancy_id))]
  const vacancyMap = new Map<string, VacancyOption>()
  if (vacancyIds.length > 0) {
    const { data: vacanciesRaw } = await supabase
      .from('vacancies')
      .select('id, title, department, location')
      .in('id', vacancyIds)
    for (const v of (vacanciesRaw || []) as VacancyOption[]) vacancyMap.set(v.id, v)
  }

  // Evaluation questions + answers
  const questionsByVacancy = new Map<string, { id: string; label: string; type: 'text' | 'score' }[]>()
  if (vacancyIds.length > 0) {
    const { data: qRaw } = await supabase
      .from('vacancy_questions')
      .select('id, label, type, sort_order, vacancy_id')
      .in('vacancy_id', vacancyIds)
      .order('sort_order', { ascending: true })
    for (const q of (qRaw || []) as { id: string; label: string; type: 'text' | 'score'; sort_order: number; vacancy_id: string }[]) {
      const arr = questionsByVacancy.get(q.vacancy_id) ?? []
      arr.push({ id: q.id, label: q.label, type: q.type })
      questionsByVacancy.set(q.vacancy_id, arr)
    }
  }

  const evaluationsByApp = new Map<string, { id: string; score: number | null; answers: { question_id: string; text_value: string | null; score_value: number | null }[] }>()
  const appIds = applications.map((a) => a.id)
  if (appIds.length > 0) {
    const { data: evalsRaw } = await supabase.from('candidate_evaluations').select('id, application_id, score').in('application_id', appIds)
    const evals = (evalsRaw || []) as { id: string; application_id: string; score: number | null }[]
    if (evals.length > 0) {
      const { data: answersRaw } = await supabase
        .from('candidate_evaluation_answers')
        .select('evaluation_id, question_id, text_value, score_value')
        .in('evaluation_id', evals.map((e) => e.id))
      const answersByEval = new Map<string, { question_id: string; text_value: string | null; score_value: number | null }[]>()
      for (const a of (answersRaw || []) as { evaluation_id: string; question_id: string; text_value: string | null; score_value: number | null }[]) {
        const arr = answersByEval.get(a.evaluation_id) ?? []
        arr.push({ question_id: a.question_id, text_value: a.text_value, score_value: a.score_value })
        answersByEval.set(a.evaluation_id, arr)
      }
      for (const e of evals) {
        if (e.application_id) {
          evaluationsByApp.set(e.application_id, { id: e.id, score: e.score, answers: answersByEval.get(e.id) ?? [] })
        }
      }
    }
  }

  // Active application count
  const activeAppStatusIds = new Set(((appStatusesRaw || []) as AppStatusRow[]).filter((s) => ['applied', 'screening', 'interview', 'offer'].includes(s.code)).map((s) => s.id))
  const activeApplicationCount = applications.filter((a) => a.status_id && activeAppStatusIds.has(a.status_id)).length

  // Open vacancies not already applied
  const appliedVacancyIds = new Set(applications.map((a) => a.vacancy_id))
  interface OpenVacancy { id: string; title: string; department: string | null }
  let openVacancies: OpenVacancy[] = []
  {
    const vacancyStatusesRaw = await getVacancyStatuses()
    const openStatusIds = vacancyStatusesRaw.filter((s) => s.code === 'open' || s.code === 'on_hold').map((s) => s.id)
    if (openStatusIds.length > 0) {
      const { data: raw } = await supabase
        .from('vacancies')
        .select('id, title, department')
        .eq('organization_id', organizationId)
        .in('status_id', openStatusIds)
        .is('deleted_at', null)
        .order('title', { ascending: true })
      openVacancies = ((raw || []) as OpenVacancy[]).filter((v) => !appliedVacancyIds.has(v.id))
    }
  }

  // Interviews
  const { data: interviewsRaw } = await supabase
    .from('interviews')
    .select('id, candidate_id, vacancy_id, application_id, interviewer_id, scheduled_at, duration_minutes, type, status, google_meet_link, meeting_link, created_at, profiles(full_name)')
    .eq('organization_id', organizationId)
    .eq('candidate_id', id)
    .order('scheduled_at', { ascending: false })
  const interviews = (interviewsRaw || []) as InterviewRow[]

  // Experience + Education + Documents + Custom fields
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
  const educationEntries  = (educationRaw  || []) as CandidateEducation[]
  const documents         = (documentsRaw  || []) as DocumentRow[]

  // Unified activity feed
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

  // Derived values
  const fullName      = `${candidate.first_name} ${candidate.last_name}`.trim()
  const avatarInitials = initials(candidate.first_name, candidate.last_name)
  const yearsExp       = computeYearsExp(experienceEntries)
  const headlineExp    = experienceEntries[0]
    ? `${experienceEntries[0].title} at ${experienceEntries[0].company}`
    : null

  return (
    <div className="mx-auto max-w-[1200px]">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        {/* Left cluster */}
        <div className="flex items-start gap-3.5">
          {/* Back button */}
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-md" asChild>
            <Link href="/candidates">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {/* Avatar */}
          <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[oklch(0.55_0.18_250/0.1)]">
            <span className="text-[17px] font-semibold text-[oklch(0.55_0.18_250)]">{avatarInitials}</span>
          </div>

          {/* Name + status + headline */}
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] text-foreground">{fullName}</h1>
              {currentStatus && (
                <StatusPill code={currentStatus.code} label={currentStatus.name} />
              )}
            </div>
            {headlineExp && (
              <p className="mt-1 text-[13px] text-muted-foreground">{headlineExp}</p>
            )}
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          <CandidateStatusSelect
            candidateId={candidate.id}
            currentStatusId={candidate.general_status_id}
            statusOptions={candidateStatuses}
          />
          <DeleteCandidateButton candidateId={id} candidateName={fullName} />
          <Button asChild size="sm" className="h-9 gap-1.5">
            <Link href={`/candidates/${id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Summary Strip ────────────────────────────────────────────────────── */}
      <SummaryStrip
        location={candidate.location}
        timezone={candidate.timezone}
        languages={candidate.languages ?? []}
        salaryExpectation={candidate.salary_expectation}
        noticePeriod={candidate.notice_period}
        yearsExperience={yearsExp}
      />

      {/* ── Two-column grid ──────────────────────────────────────────────────── */}
      <div className="grid items-start gap-5" style={{ gridTemplateColumns: '1fr 400px' }}>

        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* 1. Applied Vacancies */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-bold text-foreground">Applied vacancies</span>
                {applications.length > 0 && (
                  <>
                    <span className="text-[12px] text-muted-foreground">·</span>
                    <span className="text-[12px] text-muted-foreground">{activeApplicationCount} of {applications.length} active</span>
                  </>
                )}
              </div>
              <AddApplicationDialog
                candidateId={id}
                availableVacancies={openVacancies}
                activeApplicationCount={activeApplicationCount}
              />
            </div>
            <CandidateApplicationsList
              key={applications.map((a) => a.id).join(',')}
              candidateId={id}
              candidateName={fullName}
              allStatuses={(appStatusesRaw || []) as AppStatusRow[]}
              rejectionReasons={rejectionReasonsRaw ?? []}
              rejectionTemplates={rejectionTemplatesRaw ?? []}
              initialApplications={applications.map((app) => {
                const vacancy  = vacancyMap.get(app.vacancy_id) ?? null
                const appStatus = app.status_id ? appStatusMap.get(app.status_id) ?? null : null
                return {
                  id: app.id,
                  vacancyId: app.vacancy_id,
                  vacancyTitle: vacancy?.title ?? 'Unknown Vacancy',
                  vacancyDepartment: vacancy?.department ?? null,
                  appliedAt: app.applied_at,
                  appStatus: appStatus ?? null,
                  questions: questionsByVacancy.get(app.vacancy_id) ?? [],
                  existingEvaluation: evaluationsByApp.get(app.id) ?? null,
                }
              })}
            />
          </div>

          {/* 2. Experience (timeline) */}
          <ExperienceSection candidateId={candidate.id} initialEntries={experienceEntries} />

          {/* 3. Education */}
          <EducationSection candidateId={candidate.id} initialEntries={educationEntries} />

          {/* 4. Additional Information (custom fields, if any) */}
          {customFieldGroups.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="mb-3 text-[15px] font-bold text-foreground">Additional Information</p>
              <CustomFieldsDisplay groups={customFieldGroups} values={customFieldValues} />
            </div>
          )}

          {/* 5. Activity */}
          <ActivityFeed
            candidateId={candidate.id}
            currentUserId={user.id}
            currentUserName={profile.full_name ?? null}
            initialItems={activityItems}
          />
        </div>

        {/* ── RIGHT RAIL (sticky) ───────────────────────────────────────────── */}
        <div className="sticky top-6 space-y-4">

          {/* Contact */}
          <ContactCard
            email={candidate.email}
            phone={candidate.phone}
            linkedinUrl={candidate.linkedin_profile_url}
          />

          {/* Documents */}
          <CandidateDocuments candidateId={candidate.id} initialDocuments={documents} />

          {/* Interviews */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-foreground">Interviews</h3>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                <Link href={`/interviews/new?candidate=${id}`}>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Schedule
                </Link>
              </Button>
            </div>
            {interviews.length > 0 ? (
              <div className="space-y-2">
                {interviews.slice(0, 3).map((iv) => (
                  <div key={iv.id} className="rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="text-[13px] font-medium capitalize text-foreground">{iv.type} Interview</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {format(new Date(iv.scheduled_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                ))}
                {interviews.length > 3 && (
                  <p className="text-center text-xs text-muted-foreground">+{interviews.length - 3} more</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Calendar className="h-7 w-7 opacity-40" />
                <p className="text-[12.5px]">No interviews scheduled</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <MetadataFooter
            source={candidate.source}
            createdAt={candidate.created_at}
            updatedAt={candidate.updated_at}
            candidateId={candidate.id}
          />
        </div>
      </div>
    </div>
  )
}

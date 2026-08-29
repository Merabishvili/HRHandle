import { notFound, redirect } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { getTranslations, getLocale } from 'next-intl/server'
import { dateFnsLocale } from '@/lib/i18n/date-locale'

import { createClient } from '@/lib/supabase/server'
import {
  getVacancyStatuses,
  getApplicationStatuses,
} from '@/lib/cache/lookups'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VacancyQuestions } from '@/components/vacancies/vacancy-questions'
import { ScreeningQuestionsCard } from '@/components/vacancies/screening-questions-card'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { ApplicationFormTab } from '@/components/vacancies/application-form-tab'
import { getLinkedInIntegration } from '@/lib/actions/integrations'
import { AiAssessmentSuggester } from '@/components/vacancies/ai-assessment-suggester'
import { PrevNextNav } from '@/components/ui/prev-next-nav'

import { VacancyHeader } from '@/components/vacancies/detail/vacancy-header'
import {
  OverviewTab,
  buildAttentionList,
  formatEndDate,
} from '@/components/vacancies/detail/overview-tab'
import { JdTab } from '@/components/vacancies/detail/jd-tab'
import { SettingsTab } from '@/components/vacancies/detail/settings-tab'
import type { ApplicationStatus } from '@/lib/types/application'
import { mapPipelineStageToBucket, type PipelineStageRowForBucket } from '@/lib/pipeline-stages/bucket'
import type { LegacyStatusCode } from '@/lib/pipeline-stages/resolve'

/**
 * Wave 2.4 vacancy detail rebuild per `redesign/Vacancy Detail.dc.html`.
 *
 * Slice 1: shipping the visual restructure end-to-end —
 *
 *   - Single outer card wrapping the whole working surface, with the
 *     shared header chrome (breadcrumb bar + title row + tab strip)
 *     constant across every tab below.
 *   - 5 tabs (Overview · Job description · Scorecard & questions ·
 *     Apply form · Settings). New tab structure replaces the previous
 *     4-tab layout (Candidates / Assessment / Apply Link / Interview
 *     questions). The candidates list moves to the dedicated
 *     `/vacancies/[id]/pipeline` route — accessed via the prominent
 *     "View pipeline →" button in the header.
 *   - Overview tab: Version B (needs-attention first) + Version A's
 *     time-to-fill benchmark folded in, per the design's MY TAKE
 *     recommendation. Surfaces "Sophie's offer awaiting reply 2 days",
 *     "Interview with Ana tomorrow", "2 new applicants" — i.e. role-
 *     scoped Today.
 *   - JD tab: single About-the-role card with Improve with AI + Edit;
 *     right rail with Posting details + Preview apply page.
 *   - Scorecard tab: existing Assessment + Interview questions content
 *     reorganised. Design's "Screening questions" right rail is Wave
 *     2.5 schema-dependent and stubbed for now (tech-debt §2).
 *   - Apply form tab: existing ApplicationFormTab in the new shell.
 *   - Settings tab: Role details + Status & visibility + Pipeline
 *     stages preview + Danger zone. Per-vacancy stage customization
 *     ships with Wave 2.6; the "Add stage" pill is disabled for now.
 *
 * Default tab is `overview` to match the design. Users land on
 * "what needs doing" rather than the old applicant list.
 */

interface VacancyRow {
  id: string
  organization_id: string
  title: string
  sector_id: string | null
  status_id: string | null
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  work_mode: 'remote' | 'hybrid' | 'onsite' | null
  hiring_manager_name: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  openings_count: number
  start_date: string
  end_date: string | null
  description: string
  responsibilities: string | null
  requirements: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  application_form_token: string | null
  show_on_public_page: boolean
  vacancy_statuses:
    | {
        id: string
        name: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
      }[]
    | null
  sectors: { id: string; name: string; code: string }[] | null
}

interface ApplicationRow {
  id: string
  candidate_id: string
  pipeline_stage_id: string | null
  applied_at: string
  last_status_changed_at: string | null
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
}

interface InterviewRow {
  id: string
  application_id: string | null
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
}

function formatEmploymentType(
  t: (key: string) => string,
  value: VacancyRow['employment_type'],
): string {
  switch (value) {
    case 'full_time': return t('enum.employment.fullTime')
    case 'part_time': return t('enum.employment.partTime')
    case 'contract': return t('enum.employment.contract')
    case 'internship': return t('enum.employment.internship')
    default: return t('common.notSpecified')
  }
}

function formatWorkMode(
  t: (key: string) => string,
  value: VacancyRow['work_mode'],
): string {
  switch (value) {
    case 'remote': return t('enum.workMode.remote')
    case 'hybrid': return t('enum.workMode.hybrid')
    case 'onsite': return t('enum.workMode.onsite')
    default: return t('common.notSpecified')
  }
}

function formatSalary(vacancy: VacancyRow): string | null {
  if (vacancy.salary_min == null && vacancy.salary_max == null) return null
  const min = vacancy.salary_min != null ? vacancy.salary_min.toLocaleString() : null
  const max = vacancy.salary_max != null ? vacancy.salary_max.toLocaleString() : null
  if (min && max) return `${vacancy.salary_currency} ${min} – ${max}`
  if (min) return `${vacancy.salary_currency} ${min}+`
  if (max) return `Up to ${vacancy.salary_currency} ${max}`
  return null
}

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

export default async function VacancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const validTabs = new Set(['overview', 'jd', 'scorecard', 'application-form', 'settings'])
  const defaultTab = tab && validTabs.has(tab) ? tab : 'overview'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/pipeline')
  const organizationId = profile.organization_id

  const [vacancyStatusesRaw, _candidateStatusesRaw, _linkedInIntegration] = await Promise.all([
    getVacancyStatuses(),
    null,
    getLinkedInIntegration(),
  ])

  const [{ data: vacancyRaw }] = await Promise.all([
    supabase
      .from('vacancies')
      .select(`
        id, organization_id, title, sector_id, status_id, department, location,
        employment_type, work_mode, hiring_manager_name, salary_min, salary_max, salary_currency,
        openings_count, start_date, end_date, description, responsibilities, requirements,
        created_by, created_at, updated_at, archived_at,
        application_form_token, show_on_public_page,
        vacancy_statuses ( id, name, code ),
        sectors ( id, name, code )
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .single(),
  ])

  const vacancy = vacancyRaw as VacancyRow | null
  if (!vacancy) notFound()

  const vacancyStatuses = (vacancyStatusesRaw || []).filter((s) => s.is_active) as {
    id: string
    name: string
    code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  }[]

  const vacancyStatus =
    vacancy.vacancy_statuses?.[0] ||
    vacancyStatuses.find((s) => s.id === vacancy.status_id) ||
    null

  const appStatusesRaw = await getApplicationStatuses()
  const appStatuses = (appStatusesRaw || []) as ApplicationStatus[]
  const activeAppStatuses = appStatuses
    .filter((s) => s.is_active && !['rejected', 'withdrawn', 'hired'].includes(s.code))
    .sort((a, b) => a.sort_order - b.sort_order)
  const statusByCode = new Map(appStatuses.map((s) => [s.code, s]))

  const [
    { data: applicationsRaw },
    { data: questionsRaw },
    { data: screeningQuestionsRaw },
    { data: pipelineStagesRaw },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('id, candidate_id, pipeline_stage_id, applied_at, last_status_changed_at')
      .eq('organization_id', organizationId)
      .eq('vacancy_id', id)
      .is('deleted_at', null)
      .order('applied_at', { ascending: false }),

    supabase
      .from('vacancy_questions')
      .select('id, label, type, sort_order, must_have')
      .eq('vacancy_id', id)
      .order('sort_order', { ascending: true }),

    supabase
      .from('vacancy_screening_questions')
      .select('id, label, answer_type, is_knockout, knockout_answer, options, sort_order')
      .eq('vacancy_id', id)
      .order('sort_order', { ascending: true }),

    // Wave 2.6 Slice 3 — per-vacancy pipeline stages drive the
    // SettingsTab manager. Order matches what the recruiter sees on
    // the per-vacancy kanban.
    supabase
      .from('pipeline_stages')
      .select('id, name, type, is_terminal, sort_order, origin_template_id')
      .eq('vacancy_id', id)
      .order('sort_order', { ascending: true }),
  ])

  const allApplications = (applicationsRaw || []) as ApplicationRow[]
  const questions = (questionsRaw || []) as {
    id: string
    label: string
    type: 'text' | 'score'
    sort_order: number
    must_have?: boolean
  }[]
  const screeningQuestions = (screeningQuestionsRaw || []) as {
    id: string
    label: string
    answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
    is_knockout: boolean
    knockout_answer: string | null
    options: string[] | null
    sort_order: number
  }[]
  const canEditQuestions = profile?.role === 'owner' || profile?.role === 'admin'

  // Candidate basics for the attention rows
  const candidateIds = [...new Set(allApplications.map((a) => a.candidate_id))]
  const candidateMap = new Map<string, CandidateRow>()
  if (candidateIds.length > 0) {
    const { data: candidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name')
      .in('id', candidateIds)
      .is('deleted_at', null)
    for (const c of (candidatesRaw || []) as CandidateRow[]) candidateMap.set(c.id, c)
  }

  // Applications now carry `pipeline_stage_id` (the per-vacancy stage), not the
  // legacy `status_id` (null on every current application). Collapse each app's
  // stage back to its canonical bucket so the funnel + attention metrics count
  // real applications instead of always reading 0.
  const stageBucketById = new Map<string, LegacyStatusCode>(
    ((pipelineStagesRaw || []) as (PipelineStageRowForBucket & { id: string })[]).map((st) => [
      st.id,
      mapPipelineStageToBucket(st),
    ]),
  )
  const bucketOf = (a: ApplicationRow): LegacyStatusCode | null =>
    a.pipeline_stage_id ? (stageBucketById.get(a.pipeline_stage_id) ?? null) : null

  // Funnel counts in stage sort order
  const funnel = activeAppStatuses.map((s) => ({
    statusId: s.id,
    code: s.code,
    name: s.name,
    count: allApplications.filter((a) => bucketOf(a) === s.code).length,
  }))
  const hiredStatus = statusByCode.get('hired')
  if (hiredStatus) {
    funnel.push({
      statusId: hiredStatus.id,
      code: hiredStatus.code,
      name: hiredStatus.name,
      count: allApplications.filter((a) => bucketOf(a) === 'hired').length,
    })
  }

  const activeCandidateCount = allApplications.filter((a) => {
    const b = bucketOf(a)
    return b !== null && !['rejected', 'withdrawn', 'hired'].includes(b)
  }).length

  // Pending offers (bucket = offer, awaiting candidate response) — days
  // since the application reached the offer stage drives the urgency.
  const pendingOfferApps = allApplications.filter((a) => bucketOf(a) === 'offer')
  const now = Date.now()
  const pendingOffers = pendingOfferApps.map((a) => {
    const candidate = candidateMap.get(a.candidate_id)
    const sinceMs = a.last_status_changed_at ? Date.parse(a.last_status_changed_at) : Date.parse(a.applied_at)
    const days = Math.max(0, Math.floor((now - sinceMs) / (1000 * 60 * 60 * 24)))
    return {
      applicationId: a.id,
      candidateId: a.candidate_id,
      candidateInitials: candidate ? getInitials(candidate.first_name, candidate.last_name) : '??',
      candidateFirstName: candidate?.first_name ?? 'Candidate',
      daysAwaiting: days,
    }
  })

  // Upcoming interviews — next 36 hours, scheduled status only
  const appIds = allApplications.map((a) => a.id)
  let upcomingInterviewsTomorrow: {
    interviewId: string
    candidateId: string
    candidateInitials: string
    candidateFirstName: string
    scheduledAt: string
  }[] = []
  if (appIds.length > 0) {
    const { data: interviewsRaw } = await supabase
      .from('interviews')
      .select('id, application_id, scheduled_at, status')
      .eq('organization_id', organizationId)
      .eq('vacancy_id', id)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
    const interviews = (interviewsRaw || []) as InterviewRow[]
    const cutoff = now + 36 * 60 * 60 * 1000
    for (const interview of interviews) {
      const t = Date.parse(interview.scheduled_at)
      if (t < now || t > cutoff) continue
      const app = allApplications.find((a) => a.id === interview.application_id)
      if (!app) continue
      // Skip interviews on closed applications — a rejected/withdrawn/hired
      // candidate shouldn't surface as an "upcoming interview" needing attention.
      const appBucket = bucketOf(app)
      if (appBucket && ['rejected', 'withdrawn', 'hired'].includes(appBucket)) continue
      const candidate = candidateMap.get(app.candidate_id)
      upcomingInterviewsTomorrow.push({
        interviewId: interview.id,
        candidateId: app.candidate_id,
        candidateInitials: candidate ? getInitials(candidate.first_name, candidate.last_name) : '??',
        candidateFirstName: candidate?.first_name ?? 'Candidate',
        scheduledAt: interview.scheduled_at,
      })
    }
  }

  // New applicants — applications in the 'applied' bucket with no movement
  const newApplicantCount = allApplications.filter(
    (a) => bucketOf(a) === 'applied' && !a.last_status_changed_at,
  ).length

  const t = await getTranslations()
  const locale = await getLocale()
  const attention = buildAttentionList({
    vacancyId: id,
    pendingOffers,
    upcomingInterviewsTomorrow,
    newApplicantCount,
  }, t, locale)

  // Time-open + health
  const timeOpenDays = Math.max(
    0,
    Math.floor((now - Date.parse(vacancy.created_at)) / (1000 * 60 * 60 * 24)),
  )

  // Heuristic health label: any recent stage movement in last 7 days = good;
  // none + role open > 30 days = stale; otherwise watch.
  const recentMovement = allApplications.some((a) => {
    if (!a.last_status_changed_at) return false
    const changedAt = Date.parse(a.last_status_changed_at)
    return now - changedAt < 7 * 24 * 60 * 60 * 1000
  })
  const healthLabel: 'good' | 'watch' | 'stale' =
    recentMovement ? 'good' : timeOpenDays > 30 ? 'stale' : 'watch'

  const [vacancyCustomFieldGroups, vacancyCustomFieldValues] = await Promise.all([
    getCustomFieldSchema('vacancy'),
    getCustomFieldValues(id),
  ])

  // Prev/next paging (#2) — neighbours in the org-wide default list order
  // (newest first), independent of any list filters. Only ids are fetched.
  const { data: navRows } = await supabase
    .from('vacancies')
    .select('id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  const navIds = (navRows ?? []).map((r) => r.id as string)
  const navIdx = navIds.indexOf(id)
  const prevVacancyId = navIdx > 0 ? navIds[navIdx - 1]! : null
  const nextVacancyId = navIdx >= 0 && navIdx < navIds.length - 1 ? navIds[navIdx + 1]! : null

  return (
    <div className="mx-auto max-w-[1360px] p-4 lg:p-6">
      <PrevNextNav
        prevHref={prevVacancyId ? `/vacancies/${prevVacancyId}` : null}
        nextHref={nextVacancyId ? `/vacancies/${nextVacancyId}` : null}
        prevLabel={t('nav.prevVacancy')}
        nextLabel={t('nav.nextVacancy')}
      />
      <article className="overflow-hidden rounded-xl border border-[oklch(0.88_0.01_250)] bg-white shadow-[0_1px_3px_0_oklch(0_0_0_/_0.08)]">
        <VacancyHeader
          vacancyId={vacancy.id}
          title={vacancy.title}
          status={vacancyStatus ? { code: vacancyStatus.code, name: vacancyStatus.name } : null}
          meta={{
            employmentLabel: formatEmploymentType(t, vacancy.employment_type),
            department: vacancy.department,
            location: vacancy.location,
            openedDaysAgo: timeOpenDays,
            endDate: formatEndDate(vacancy.end_date, locale),
          }}
          applicationFormToken={vacancy.application_form_token}
        />

        <Tabs key={defaultTab} defaultValue={defaultTab} className="border-t border-[oklch(0.93_0.01_250)]">
          <TabsList className="h-auto w-full justify-start rounded-none border-b border-[oklch(0.93_0.01_250)] bg-transparent px-5 py-0 sm:px-6">
            <TabTriggerStyled value="overview">{t('vacTabs.overview')}</TabTriggerStyled>
            <TabTriggerStyled value="jd">{t('vacTabs.jd')}</TabTriggerStyled>
            <TabTriggerStyled value="scorecard">{t('vacTabs.scorecard')}</TabTriggerStyled>
            <TabTriggerStyled value="application-form">{t('vacTabs.applicationForm')}</TabTriggerStyled>
            <TabTriggerStyled value="settings">{t('vacTabs.settings')}</TabTriggerStyled>
          </TabsList>

          <TabsContent value="overview" className="m-0">
            <OverviewTab
              vacancyId={vacancy.id}
              meta={{
                timeOpenDays,
                activeCandidateCount,
                salaryRangeLabel: formatSalary(vacancy),
                endDate: vacancy.end_date ? format(new Date(vacancy.end_date), 'MMM d, yyyy', { locale: dateFnsLocale(locale) }) : null,
                healthLabel,
              }}
              attention={attention}
              funnel={funnel}
              hiringManagerName={vacancy.hiring_manager_name}
              currentUserName={profile.full_name ?? user.email ?? t('vacOverview.you')}
              applicationFormToken={vacancy.application_form_token}
            />
          </TabsContent>

          <TabsContent value="jd" className="m-0">
            <JdTab
              vacancyId={vacancy.id}
              description={vacancy.description}
              responsibilities={vacancy.responsibilities}
              requirements={vacancy.requirements}
              postingDetails={{
                visibility: vacancy.show_on_public_page ? 'public' : 'private',
                language: 'English',
                lastEditedAt: vacancy.updated_at,
              }}
              applicationFormToken={vacancy.application_form_token}
              customFieldGroups={vacancyCustomFieldGroups}
              customFieldValues={vacancyCustomFieldValues}
            />
          </TabsContent>

          <TabsContent value="scorecard" className="m-0 bg-[oklch(0.985_0.002_247)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <p className="text-[12.5px] text-muted-foreground">
                {t.rich('vacDetail.scorecardIntro', { b: (c) => <span className="font-semibold text-foreground">{c}</span> })}
              </p>
              <AiAssessmentSuggester
                vacancyId={vacancy.id}
                existingSkillLabels={questions.filter((q) => q.type === 'score').map((q) => q.label)}
                existingPromptLabels={questions.filter((q) => q.type === 'text').map((q) => q.label)}
                canEdit={canEditQuestions}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('scoreModal.scorecard')}>
                  <h2 className="text-[15px] font-bold text-foreground">{t('scoreModal.scorecard')}</h2>
                  <p className="mb-3 text-[12.5px] text-muted-foreground">{t('vacDetail.scorecardDesc')}</p>
                  <VacancyQuestions
                    vacancyId={vacancy.id}
                    initialQuestions={questions.filter((q) => q.type === 'score')}
                    questionType="score"
                    canEdit={canEditQuestions}
                  />
                </section>
                <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('scoreModal.interviewGuide')}>
                  <h2 className="text-[15px] font-bold text-foreground">{t('scoreModal.interviewGuide')}</h2>
                  <p className="mb-3 text-[12.5px] text-muted-foreground">{t('vacDetail.guideDesc')}</p>
                  <VacancyQuestions
                    vacancyId={vacancy.id}
                    initialQuestions={questions.filter((q) => q.type === 'text')}
                    questionType="text"
                    canEdit={canEditQuestions}
                  />
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="application-form" className="m-0 bg-[oklch(0.985_0.002_247)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              {/* Screening questions are candidate-facing — they render on the
                  apply form, so they're configured here (moved off the
                  interviewer-facing Scorecard tab). */}
              <ScreeningQuestionsCard
                vacancyId={vacancy.id}
                initialQuestions={screeningQuestions}
                canEdit={canEditQuestions}
              />
              <div className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
                <ApplicationFormTab
                  vacancyId={vacancy.id}
                  initialToken={vacancy.application_form_token ?? null}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="m-0">
            <SettingsTab
              vacancyId={vacancy.id}
              vacancyTitle={vacancy.title}
              roleDetails={{
                title: vacancy.title,
                department: vacancy.department,
                location: vacancy.location,
                employmentTypeLabel: formatEmploymentType(t, vacancy.employment_type),
                workModeLabel: formatWorkMode(t, vacancy.work_mode),
                endDate: vacancy.end_date,
              }}
              status={{
                current: vacancyStatus
                  ? { id: vacancyStatus.id, name: vacancyStatus.name, code: vacancyStatus.code }
                  : vacancyStatuses[0]!,
                available: vacancyStatuses,
              }}
              stages={
                (pipelineStagesRaw ?? []) as {
                  id: string
                  name: string
                  type: 'standard' | 'review' | 'interview' | 'offer'
                  is_terminal: boolean
                  sort_order: number
                  origin_template_id: string | null
                }[]
              }
              canEditStages={canEditQuestions}
            />
          </TabsContent>
        </Tabs>
      </article>
    </div>
  )
}

function TabTriggerStyled({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="-mb-px rounded-none !border-x-0 !border-t-0 border-b-2 border-transparent !bg-transparent px-0 py-3.5 mr-6 text-[13.5px] font-normal text-muted-foreground !shadow-none data-[state=active]:border-b-[oklch(0.55_0.18_250)] data-[state=active]:!bg-transparent data-[state=active]:text-[oklch(0.2_0.16_250)] data-[state=active]:font-semibold data-[state=active]:!shadow-none"
    >
      {children}
    </TabsTrigger>
  )
}

// Suppress import-but-not-used; the formatDistanceToNow re-export is here so future
// attention-list builders can pull from the same module without a second import.
void formatDistanceToNow

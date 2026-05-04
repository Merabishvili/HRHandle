import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  Edit,
  MapPin,
  Briefcase,
  DollarSign,
  Clock,
  LayoutGrid,
  UserCircle,
  Download,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getVacancyStatuses, getCandidateStatuses, getApplicationStatuses } from '@/lib/cache/lookups'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VACANCY_STATUS_COLORS } from '@/lib/types/vacancy'
import { LinkedInShareButton } from '@/components/vacancies/linkedin-share-button'
import { VacancyQuestions } from '@/components/vacancies/vacancy-questions'
import { VacancyApplicationsToolbar } from '@/components/vacancies/vacancy-applications-toolbar'
import { CustomFieldsDisplay } from '@/components/custom-fields/custom-fields-display'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { ApplicationFormTab } from '@/components/vacancies/application-form-tab'
import { VacancyApplicationsList } from '@/components/vacancies/vacancy-applications-list'
import { DuplicateVacancyButton } from '@/components/vacancies/duplicate-vacancy-button'
import { VacancyStatusSelect } from '@/components/vacancies/vacancy-status-select'
import { AddCandidateToVacancyDialog } from '@/components/vacancies/add-candidate-to-vacancy-dialog'

interface VacancyRow {
  id: string
  organization_id: string
  title: string
  sector_id: string | null
  status_id: string | null
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
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
  vacancy_statuses:
    | {
        id: string
        name: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
      }[]
    | null
  sectors:
    | {
        id: string
        name: string
        code: string
      }[]
    | null
}

interface VacancyStatusRow {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
}

interface SectorRow {
  id: string
  name: string
  code: string
}

interface CandidateGeneralStatusRow {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
}

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  status_id: string | null
  applied_at: string
}

interface AppStatusRow {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
  sort_order: number
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  general_status_id: string | null
}

function formatEmploymentType(value: VacancyRow['employment_type']): string {
  if (!value) return 'Not specified'

  switch (value) {
    case 'full_time':
      return 'Full-time'
    case 'part_time':
      return 'Part-time'
    case 'contract':
      return 'Contract'
    case 'internship':
      return 'Internship'
    default:
      return value
  }
}

function formatSalary(vacancy: VacancyRow): string | null {
  if (vacancy.salary_min == null && vacancy.salary_max == null) return null

  const min = vacancy.salary_min != null ? vacancy.salary_min.toLocaleString() : null
  const max = vacancy.salary_max != null ? vacancy.salary_max.toLocaleString() : null

  if (min && max) return `${vacancy.salary_currency} ${min} - ${max}`
  if (min) return `${vacancy.salary_currency} ${min}+`
  if (max) return `Up to ${vacancy.salary_currency} ${max}`

  return null
}

function getCandidateFullName(candidate?: { first_name: string; last_name: string } | null): string {
  if (!candidate) return 'Unknown candidate'
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

function getCandidateInitials(candidate?: { first_name: string; last_name: string } | null): string {
  if (!candidate) return '?'
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}

export default async function VacancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ appSearch?: string; appStatus?: string; tab?: string }>
}) {
  const { id } = await params
  const { appSearch = '', appStatus, tab } = await searchParams
  const defaultTab = tab === 'qe' ? 'qe' : tab === 'application-form' ? 'application-form' : 'applications'
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) {
    redirect('/dashboard')
  }

  const [vacancyStatusesRaw, candidateStatusesRaw] = await Promise.all([
    getVacancyStatuses(),
    getCandidateStatuses(),
  ])

  const [
    { data: vacancyRaw },
    { data: sectorsRaw },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select(`
        id,
        organization_id,
        title,
        sector_id,
        status_id,
        department,
        location,
        employment_type,
        hiring_manager_name,
        salary_min,
        salary_max,
        salary_currency,
        openings_count,
        start_date,
        end_date,
        description,
        responsibilities,
        requirements,
        created_by,
        created_at,
        updated_at,
        archived_at,
        application_form_token,
        vacancy_statuses (
          id,
          name,
          code
        ),
        sectors (
          id,
          name,
          code
        )
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .single(),

    supabase
      .from('sectors')
      .select('id, name, code')
      .order('name', { ascending: true }),
  ])

  const vacancy = vacancyRaw as VacancyRow | null

  if (!vacancy) {
    notFound()
  }

  const vacancyStatuses = (vacancyStatusesRaw || []).filter((s) => s.is_active) as VacancyStatusRow[]
  const sectors = (sectorsRaw || []) as SectorRow[]
  const candidateStatuses = (candidateStatusesRaw || []) as CandidateGeneralStatusRow[]

  const candidateStatusMap = new Map(candidateStatuses.map((s) => [s.id, s]))

  const appStatusesRaw = await getApplicationStatuses()

  const [
    { data: applicationsRaw, count: applicantsCount },
    { data: questionsRaw },
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from('applications')
        .select('id, candidate_id, vacancy_id, status_id, applied_at', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('vacancy_id', id)
        .is('deleted_at', null)
        .order('applied_at', { ascending: false })
      if (appStatus) q = q.eq('status_id', appStatus)
      return q
    })(),

    supabase
      .from('vacancy_questions')
      .select('id, label, type, sort_order')
      .eq('vacancy_id', id)
      .order('sort_order', { ascending: true }),

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

  const allApplications = (applicationsRaw || []) as ApplicationRow[]
  const appStatuses = (appStatusesRaw || []) as AppStatusRow[]
  const appStatusMap = new Map(appStatuses.map((s) => [s.id, s]))
  const questions = (questionsRaw || []) as { id: string; label: string; type: 'text' | 'score'; sort_order: number }[]
  const canEditQuestions = profile?.role === 'owner' || profile?.role === 'admin'

  // Fetch candidate data separately for reliability
  const appCandidateIds = [...new Set(allApplications.map((a) => a.candidate_id))]
  let appCandidateMap = new Map<string, CandidateRow>()
  if (appCandidateIds.length > 0) {
    const { data: appCandidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, general_status_id')
      .in('id', appCandidateIds)
      .is('deleted_at', null)
    for (const c of (appCandidatesRaw || []) as CandidateRow[]) {
      appCandidateMap.set(c.id, c)
    }
  }

  // Fetch evaluations for all applications
  type EvalRow = { id: string; application_id: string; score: number | null }
  type AnswerRow = { evaluation_id: string; question_id: string; text_value: string | null; score_value: number | null }
  const evaluationsByApp = new Map<string, { id: string; score: number | null; answers: { question_id: string; text_value: string | null; score_value: number | null }[] }>()
  const appIds = allApplications.map((a) => a.id)
  if (appIds.length > 0) {
    const { data: evalsRaw } = await supabase
      .from('candidate_evaluations')
      .select('id, application_id, score')
      .in('application_id', appIds)
    const evals = (evalsRaw || []) as EvalRow[]
    const evalIds = evals.map((e) => e.id)
    const answersByEval = new Map<string, AnswerRow[]>()
    if (evalIds.length > 0) {
      const { data: answersRaw } = await supabase
        .from('candidate_evaluation_answers')
        .select('evaluation_id, question_id, text_value, score_value')
        .in('evaluation_id', evalIds)
      for (const a of (answersRaw || []) as AnswerRow[]) {
        const existing = answersByEval.get(a.evaluation_id) ?? []
        existing.push(a)
        answersByEval.set(a.evaluation_id, existing)
      }
    }
    for (const e of evals) {
      evaluationsByApp.set(e.application_id, {
        id: e.id,
        score: e.score,
        answers: answersByEval.get(e.id) ?? [],
      })
    }
  }

  // Filter by candidate name search after candidate map is populated
  const filteredApplications = appSearch.trim()
    ? allApplications.filter((app) => {
        const c = appCandidateMap.get(app.candidate_id)
        if (!c) return false
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(appSearch.trim().toLowerCase())
      })
    : allApplications

  const vacancyStatus =
    vacancy.vacancy_statuses?.[0] ||
    vacancyStatuses.find((status) => status.id === vacancy.status_id) ||
    null

  const sector =
    vacancy.sectors?.[0] ||
    sectors.find((item) => item.id === vacancy.sector_id) ||
    null

  const salaryText = formatSalary(vacancy)

  const [vacancyCustomFieldGroups, vacancyCustomFieldValues] = await Promise.all([
    getCustomFieldSchema('vacancy'),
    getCustomFieldValues(id),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/vacancies"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
              {vacancyStatus ? (
                <VacancyStatusSelect
                  vacancyId={vacancy.id}
                  current={vacancyStatus}
                  options={vacancyStatuses}
                />
              ) : (
                <Badge variant="secondary">Unknown</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {vacancy.department && (
                <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{vacancy.department}</span>
              )}
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{vacancy.location || 'Remote'}</span>
              {salaryText && (
                <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />{salaryText}</span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Posted {formatDistanceToNow(new Date(vacancy.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LinkedInShareButton
            title={vacancy.title}
            location={vacancy.location}
            employmentType={vacancy.employment_type}
            department={vacancy.department}
            description={vacancy.description}
            responsibilities={vacancy.responsibilities ?? null}
            requirements={vacancy.requirements}
          />
          <Button variant="outline" asChild>
            <Link href={`/vacancies/${id}/pipeline`}>
              <LayoutGrid className="mr-2 h-4 w-4" />Pipeline
            </Link>
          </Button>
          <DuplicateVacancyButton vacancyId={id} />
          <Button asChild>
            <Link href={`/vacancies/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />Edit Vacancy
            </Link>
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <Tabs defaultValue={defaultTab}>
        <div className="border-b border-border">
          <TabsList className="h-auto w-fit rounded-none bg-transparent p-0 gap-0">
            <TabsTrigger
              value="applications"
              className="-mb-px rounded-none !border-x-0 !border-t-0 border-b-2 border-transparent !bg-transparent px-4 py-2.5 text-sm font-normal text-muted-foreground !shadow-none data-[state=active]:border-b-primary data-[state=active]:!bg-transparent data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:!shadow-none"
            >
              Candidates
              {(applicantsCount ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {applicantsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="qe"
              className="-mb-px rounded-none !border-x-0 !border-t-0 border-b-2 border-transparent !bg-transparent px-4 py-2.5 text-sm font-normal text-muted-foreground !shadow-none data-[state=active]:border-b-primary data-[state=active]:!bg-transparent data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:!shadow-none"
            >
              Assessment
            </TabsTrigger>
            <TabsTrigger
              value="application-form"
              className="-mb-px rounded-none !border-x-0 !border-t-0 border-b-2 border-transparent !bg-transparent px-4 py-2.5 text-sm font-normal text-muted-foreground !shadow-none data-[state=active]:border-b-primary data-[state=active]:!bg-transparent data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:!shadow-none"
            >
              Apply Link
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Applications tab — split: list left, overview right */}
        <TabsContent value="applications" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Applications list */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <VacancyApplicationsToolbar
                  initialSearch={appSearch}
                  initialStatus={appStatus || ''}
                  appStatuses={appStatuses}
                />
                <div className="flex items-center gap-2">
                  <AddCandidateToVacancyDialog vacancyId={id} />
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/export/applications?vacancy_id=${id}`} download>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Export CSV
                    </a>
                  </Button>
                </div>
              </div>
              {filteredApplications.length > 0 ? (
                <>
                  <VacancyApplicationsList
                    key={filteredApplications.map((a) => a.id).join(',')}
                    allStatuses={appStatuses}
                    rejectionReasons={rejectionReasonsRaw ?? []}
                    rejectionTemplates={rejectionTemplatesRaw ?? []}
                    vacancyId={id}
                    questions={questions}
                    applications={filteredApplications.map((application) => {
                      const candidate = appCandidateMap.get(application.candidate_id)
                      const generalStatus = candidate?.general_status_id
                        ? (candidateStatusMap.get(candidate.general_status_id) ?? null)
                        : null
                      return {
                        id: application.id,
                        candidateId: application.candidate_id,
                        candidateName: candidate
                          ? `${candidate.first_name} ${candidate.last_name}`.trim()
                          : 'Unknown candidate',
                        initials: candidate
                          ? `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
                          : '?',
                        appliedAt: application.applied_at,
                        statusId: application.status_id,
                        generalStatus: generalStatus
                          ? { id: generalStatus.id, name: generalStatus.name, code: generalStatus.code }
                          : null,
                        existingEvaluation: evaluationsByApp.get(application.id) ?? null,
                      }
                    })}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                  <UserCircle className="h-10 w-10 text-muted-foreground/40" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    {appSearch || appStatus ? 'No matching applicants' : 'No applicants yet'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {appSearch || appStatus ? 'Try adjusting your filters.' : 'Add candidates to start tracking their progress.'}
                  </p>
                  {!appSearch && !appStatus && (
                    <div className="mt-6">
                      <AddCandidateToVacancyDialog vacancyId={id} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar: overview + description */}
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {vacancyStatus ? (
                      <Badge variant="secondary" className={VACANCY_STATUS_COLORS[vacancyStatus.code]}>
                        {vacancyStatus.name}
                      </Badge>
                    ) : (
                      <span className="text-sm font-medium">Unknown</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Applicants</span>
                    <span className="text-sm font-medium">{applicantsCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Employment</span>
                    <span className="text-sm font-medium">{formatEmploymentType(vacancy.employment_type)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Openings</span>
                    <span className="text-sm font-medium">{vacancy.openings_count}</span>
                  </div>
                  {sector && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Sector</span>
                      <span className="text-sm font-medium">{sector.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Start Date</span>
                    <span className="text-sm font-medium">{new Date(vacancy.start_date).toLocaleDateString()}</span>
                  </div>
                  {vacancy.end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">End Date</span>
                      <span className="text-sm font-medium">{new Date(vacancy.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {salaryText && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Salary</span>
                      <span className="text-sm font-medium">{salaryText}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {vacancy.description && (
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-base">Job Description</CardTitle></CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">{vacancy.description}</div>
                  </CardContent>
                </Card>
              )}
              {vacancy.requirements && (
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-base">Requirements</CardTitle></CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground">{vacancy.requirements}</div>
                  </CardContent>
                </Card>
              )}
              {vacancyCustomFieldGroups.length > 0 && (
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-base">Additional Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <CustomFieldsDisplay
                      groups={vacancyCustomFieldGroups}
                      values={vacancyCustomFieldValues}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Questionary & Evaluation tab — two columns */}
        <TabsContent value="qe" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Text questions (Questionary) */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Questionary</CardTitle>
                <p className="text-sm text-muted-foreground">Open-ended questions for candidates</p>
              </CardHeader>
              <CardContent>
                <VacancyQuestions
                  vacancyId={id}
                  initialQuestions={questions.filter((q) => q.type === 'text')}
                  questionType="text"
                  canEdit={canEditQuestions}
                />
              </CardContent>
            </Card>

            {/* Right: Score criteria (Evaluation) */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Evaluation Criteria</CardTitle>
                <p className="text-sm text-muted-foreground">Score-based criteria (1–10) for candidate assessment</p>
              </CardHeader>
              <CardContent>
                <VacancyQuestions
                  vacancyId={id}
                  initialQuestions={questions.filter((q) => q.type === 'score')}
                  questionType="score"
                  canEdit={canEditQuestions}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Application Form tab */}
        <TabsContent value="application-form" className="mt-4">
          <div className="max-w-2xl">
            <ApplicationFormTab
              vacancyId={id}
              initialToken={vacancy.application_form_token ?? null}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
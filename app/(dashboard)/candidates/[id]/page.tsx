import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Edit,
  Mail,
  Phone,
  Linkedin,
  Briefcase,
  Calendar,
  Clock,
} from 'lucide-react'
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types/candidate'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import { formatDistanceToNow, format } from 'date-fns'
import { CandidateStatusSelect } from '@/components/candidates/candidate-status-select'
import { CandidateNotes } from '@/components/candidates/candidate-notes'
import { CandidateDocuments } from '@/components/candidates/candidate-documents'
import { ApplicationEvaluation } from '@/components/candidates/application-evaluation'

interface CandidateRow {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  email: string | null
  phone: string | null
  current_company: string | null
  current_position: string | null
  years_of_experience: number | null
  linkedin_profile_url: string | null
  source: string | null
  general_status_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface CandidateStatusOption {
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
  updated_at: string
}

interface AppStatusRow {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
  sort_order: number
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
  created_at: string
  updated_at: string
  profiles:
    | {
        full_name: string | null
      }[]
    | null
}

interface NoteRow {
  id: string
  text: string
  author_id: string
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

function getCandidateFullName(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

function getCandidateInitials(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    notFound()
  }

  const organizationId = profile.organization_id

  const [
    { data: candidateRaw },
    { data: candidateStatusesRaw },
    { data: appStatusesRaw },
  ] = await Promise.all([
    supabase
      .from('candidates')
      .select(`
        id,
        organization_id,
        first_name,
        last_name,
        date_of_birth,
        email,
        phone,
        current_company,
        current_position,
        years_of_experience,
        linkedin_profile_url,
        source,
        general_status_id,
        created_at,
        updated_at,
        deleted_at
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .single(),

    supabase
      .from('candidate_statuses')
      .select('id, name, code, sort_order')
      .order('sort_order', { ascending: true }),

    supabase
      .from('application_statuses')
      .select('id, name, code, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const candidate = candidateRaw as CandidateRow | null

  if (!candidate) {
    notFound()
  }

  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusOption[]
  const currentStatus = candidate.general_status_id
    ? candidateStatuses.find((status) => status.id === candidate.general_status_id) || null
    : null

  const appStatusMap = new Map(
    ((appStatusesRaw || []) as AppStatusRow[]).map((s) => [s.id, s])
  )

  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id, status_id, applied_at, updated_at')
    .eq('organization_id', organizationId)
    .eq('candidate_id', id)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })

  const applications = (applicationsRaw || []) as ApplicationRow[]

  // Fetch vacancies separately to avoid unreliable nested joins
  const vacancyIds = [...new Set(applications.map((a) => a.vacancy_id))]
  const vacancyMap = new Map<string, VacancyOption>()
  if (vacancyIds.length > 0) {
    const { data: vacanciesRaw } = await supabase
      .from('vacancies')
      .select('id, title, department, location')
      .in('id', vacancyIds)
    for (const v of (vacanciesRaw || []) as VacancyOption[]) {
      vacancyMap.set(v.id, v)
    }
  }

  const primaryApplication = applications[0] || null
  const primaryVacancy = primaryApplication ? vacancyMap.get(primaryApplication.vacancy_id) ?? null : null

  // Fetch evaluation questions per vacancy and evaluations per application
  const questionsByVacancy = new Map<string, { id: string; label: string; type: 'text' | 'score' }[]>()
  if (vacancyIds.length > 0) {
    const { data: questionsRaw } = await supabase
      .from('vacancy_questions')
      .select('id, label, type, sort_order, vacancy_id')
      .in('vacancy_id', vacancyIds)
      .order('sort_order', { ascending: true })
    for (const q of (questionsRaw || []) as { id: string; label: string; type: 'text' | 'score'; sort_order: number; vacancy_id: string }[]) {
      const existing = questionsByVacancy.get(q.vacancy_id) ?? []
      existing.push({ id: q.id, label: q.label, type: q.type })
      questionsByVacancy.set(q.vacancy_id, existing)
    }
  }

  const evaluationsByApp = new Map<string, { id: string; score: number | null; answers: { question_id: string; text_value: string | null; score_value: number | null }[] }>()
  const appIds = applications.map((a) => a.id)
  if (appIds.length > 0) {
    const { data: evalsRaw } = await supabase
      .from('candidate_evaluations')
      .select('id, application_id, score')
      .in('application_id', appIds)
    const evals = (evalsRaw || []) as { id: string; application_id: string; score: number | null }[]
    const evalIds = evals.map((e) => e.id)
    let answersByEval = new Map<string, { question_id: string; text_value: string | null; score_value: number | null }[]>()
    if (evalIds.length > 0) {
      const { data: answersRaw } = await supabase
        .from('candidate_evaluation_answers')
        .select('evaluation_id, question_id, text_value, score_value')
        .in('evaluation_id', evalIds)
      for (const a of (answersRaw || []) as { evaluation_id: string; question_id: string; text_value: string | null; score_value: number | null }[]) {
        const existing = answersByEval.get(a.evaluation_id) ?? []
        existing.push({ question_id: a.question_id, text_value: a.text_value, score_value: a.score_value })
        answersByEval.set(a.evaluation_id, existing)
      }
    }
    for (const e of evals) {
      if (e.application_id) {
        evaluationsByApp.set(e.application_id, {
          id: e.id,
          score: e.score,
          answers: answersByEval.get(e.id) ?? [],
        })
      }
    }
  }

  const { data: interviewsRaw } = await supabase
    .from('interviews')
    .select(`
      id,
      candidate_id,
      vacancy_id,
      application_id,
      interviewer_id,
      scheduled_at,
      duration_minutes,
      type,
      status,
      created_at,
      updated_at,
      profiles (
        full_name
      )
    `)
    .eq('organization_id', organizationId)
    .eq('candidate_id', id)
    .order('scheduled_at', { ascending: false })

  const interviews = (interviewsRaw || []) as InterviewRow[]

  const [{ data: notesRaw }, { data: documentsRaw }] = await Promise.all([
    supabase
      .from('candidate_notes')
      .select('id, text, author_id, created_at, profiles(full_name)')
      .eq('candidate_id', id)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    supabase
      .from('candidate_documents')
      .select('id, file_name, file_size, mime_type, document_type, created_at')
      .eq('candidate_id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const notes = (notesRaw || []) as NoteRow[]
  const documents = (documentsRaw || []) as DocumentRow[]

  const fullName = getCandidateFullName(candidate)
  const initials = getCandidateInitials(candidate)

  const activeStatusCodes = new Set(['applied', 'screening', 'interview', 'offer'])
  let overviewScore: number | null = null
  let overviewScoreIsActive = false
  for (const app of applications) {
    const appStatus = app.status_id ? appStatusMap.get(app.status_id) ?? null : null
    const evaluation = evaluationsByApp.get(app.id) ?? null
    if (evaluation?.score != null && appStatus && activeStatusCodes.has(appStatus.code)) {
      overviewScore = evaluation.score
      overviewScoreIsActive = true
      break
    }
  }
  if (overviewScore === null) {
    for (const app of applications) {
      const evaluation = evaluationsByApp.get(app.id) ?? null
      if (evaluation?.score != null) {
        overviewScore = evaluation.score
        break
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>

                {currentStatus ? (
                  <Badge
                    variant="secondary"
                    className={CANDIDATE_GENERAL_STATUS_COLORS[currentStatus.code]}
                  >
                    {currentStatus.name}
                  </Badge>
                ) : (
                  <Badge variant="secondary">No status</Badge>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {candidate.current_position && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {candidate.current_position}
                    {candidate.current_company ? ` at ${candidate.current_company}` : ''}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Added {formatDistanceToNow(new Date(candidate.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CandidateStatusSelect
            candidateId={candidate.id}
            currentStatusId={candidate.general_status_id}
            statusOptions={candidateStatuses}
          />

          <Button asChild>
            <Link href={`/candidates/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Candidate Profile */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Candidate Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Current Position</p>
                <p className="font-medium text-foreground">{candidate.current_position || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Company</p>
                <p className="font-medium text-foreground">{candidate.current_company || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Years of Experience</p>
                <p className="font-medium text-foreground">
                  {candidate.years_of_experience != null ? `${candidate.years_of_experience} years` : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium text-foreground">
                  {candidate.date_of_birth ? format(new Date(candidate.date_of_birth), 'dd MMM yyyy') : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium text-foreground">{candidate.source || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium text-foreground">{format(new Date(candidate.updated_at), 'MMM d, yyyy')}</p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Applications */}
          <Card className="border-border">
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Applications</CardTitle>
                  <CardDescription>Pipeline history and evaluations</CardDescription>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/candidates/${id}/edit`}>Manage</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((application) => {
                    const vacancy = vacancyMap.get(application.vacancy_id) ?? null
                    const appStatus = application.status_id ? appStatusMap.get(application.status_id) ?? null : null
                    const qs = questionsByVacancy.get(application.vacancy_id) ?? []
                    const evaluation = evaluationsByApp.get(application.id) ?? null
                    return (
                      <ApplicationEvaluation
                        key={application.id}
                        applicationId={application.id}
                        vacancyId={application.vacancy_id}
                        vacancyTitle={vacancy?.title ?? 'Unknown Vacancy'}
                        vacancyDepartment={vacancy?.department ?? null}
                        candidateId={id}
                        appliedAt={application.applied_at}
                        appStatus={appStatus}
                        questions={qs}
                        existingEvaluation={evaluation}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No applications yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Notes */}
          <CandidateNotes
            candidateId={candidate.id}
            initialNotes={notes}
            currentUserId={user.id}
          />
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* 1. Contact Information */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {candidate.email && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a href={`mailto:${candidate.email}`} className="truncate text-sm text-foreground hover:underline">{candidate.email}</a>
                  </div>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <a href={`tel:${candidate.phone}`} className="text-sm text-foreground hover:underline">{candidate.phone}</a>
                  </div>
                </div>
              )}
              {candidate.linkedin_profile_url && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">LinkedIn</p>
                    <a href={candidate.linkedin_profile_url} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:underline">
                      View Profile
                    </a>
                  </div>
                </div>
              )}
              {!candidate.email && !candidate.phone && !candidate.linkedin_profile_url && (
                <p className="text-sm text-muted-foreground">No contact information available.</p>
              )}
            </CardContent>
          </Card>

          {/* 2. Overview */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {currentStatus ? (
                  <Badge variant="secondary" className={CANDIDATE_GENERAL_STATUS_COLORS[currentStatus.code]}>
                    {currentStatus.name}
                  </Badge>
                ) : (
                  <span className="text-sm font-medium">Not set</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Applications</span>
                <span className="text-sm font-medium">{applications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <span className="text-sm font-medium">{candidate.source || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Added</span>
                <span className="text-sm font-medium">{format(new Date(candidate.created_at), 'MMM d, yyyy')}</span>
              </div>
              {overviewScore !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {overviewScoreIsActive ? 'Active application score' : 'Recent application score'}
                  </span>
                  <span className="text-sm font-medium">{overviewScore} / 100</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Documents */}
          <CandidateDocuments
            candidateId={candidate.id}
            initialDocuments={documents}
          />

          {/* 3. Interviews (max 3) */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Interviews</CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/interviews/new?candidate=${id}`}>Schedule</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {interviews.length > 0 ? (
                <div className="space-y-3">
                  {interviews.slice(0, 3).map((interview) => (
                    <div key={interview.id} className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium capitalize text-foreground">{interview.type} Interview</p>
                        <Badge variant="secondary" className="text-xs capitalize">{interview.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(interview.scheduled_at), 'MMM d, yyyy')} · {format(new Date(interview.scheduled_at), 'h:mm a')}
                      </p>
                    </div>
                  ))}
                  {interviews.length > 3 && (
                    <p className="text-center text-xs text-muted-foreground">+{interviews.length - 3} more</p>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Calendar className="mx-auto h-7 w-7 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">No interviews yet</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
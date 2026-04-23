import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Video, Phone, Building, ExternalLink } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

interface InterviewRow {
  id: string
  candidate_id: string
  vacancy_id: string
  application_id: string | null
  interviewer_id: string | null
  scheduled_at: string
  duration_minutes: number
  type: 'video' | 'phone' | 'onsite'
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  google_meet_link: string | null
  candidates:
    | {
        id: string
        first_name: string
        last_name: string
      }[]
    | null
  vacancies:
    | {
        id: string
        title: string
        organization_id: string
      }[]
    | null
  profiles:
    | {
        full_name: string | null
      }[]
    | null
}

interface CandidateOption {
  id: string
  first_name: string
  last_name: string
}

interface VacancyOption {
  id: string
  title: string
}

interface TeamMemberOption {
  id: string
  full_name: string | null
}

function getCandidateFullName(candidate?: { first_name: string; last_name: string } | null) {
  if (!candidate) return 'Unknown candidate'
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

export default async function InterviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) return null

  const [
    { data: interviewsRaw },
    { data: candidatesRaw },
    { data: vacanciesRaw },
    { data: teamMembersRaw },
  ] = await Promise.all([
    supabase
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
        google_meet_link,
        candidates (
          id,
          first_name,
          last_name
        ),
        vacancies!inner (
          id,
          title,
          organization_id
        ),
        profiles (
          full_name
        )
      `)
      .eq('organization_id', organizationId)
      .order('scheduled_at', { ascending: true }),

    supabase
      .from('candidates')
      .select('id, first_name, last_name')
      .eq('organization_id', organizationId)
      .is('deleted_at', null),

    supabase
      .from('vacancies')
      .select('id, title')
      .eq('organization_id', organizationId)
      .is('archived_at', null),

    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
  ])

  const interviews = (interviewsRaw || []) as InterviewRow[]
  const candidates = (candidatesRaw || []) as CandidateOption[]
  const vacancies = (vacanciesRaw || []) as VacancyOption[]
  const teamMembers = (teamMembersRaw || []) as TeamMemberOption[]

  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const vacancyMap = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]))
  const teamMemberMap = new Map(teamMembers.map((member) => [member.id, member]))

  const upcomingInterviews = interviews.filter(
    (interview) =>
      !isPast(new Date(interview.scheduled_at)) && interview.status === 'scheduled'
  )

  const pastInterviews = interviews.filter(
    (interview) =>
      isPast(new Date(interview.scheduled_at)) || interview.status !== 'scheduled'
  )

  const getInterviewIcon = (type: string) => {
    switch (type) {
      case 'video':
        return Video
      case 'phone':
        return Phone
      case 'onsite':
        return Building
      default:
        return Calendar
    }
  }

  const getTimeLabel = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'MMM d, yyyy')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      case 'no_show':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interviews</h1>
          <p className="text-muted-foreground">Manage and schedule candidate interviews.</p>
        </div>

        <Button asChild>
          <Link href="/interviews/new">
            <Plus className="mr-2 h-4 w-4" />
            Schedule Interview
          </Link>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Upcoming Interviews</CardTitle>
          <CardDescription>{upcomingInterviews.length} scheduled interviews</CardDescription>
        </CardHeader>

        <CardContent>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-4">
              {upcomingInterviews.map((interview) => {
                const Icon = getInterviewIcon(interview.type)
                const scheduledDate = new Date(interview.scheduled_at)

                const relatedCandidate = interview.candidates?.[0] || null
                const fallbackCandidate = candidateMap.get(interview.candidate_id) || null
                const candidate = relatedCandidate || fallbackCandidate

                const relatedVacancy = interview.vacancies?.[0] || null
                const fallbackVacancy = vacancyMap.get(interview.vacancy_id) || null
                const vacancy = relatedVacancy || fallbackVacancy

                const relatedInterviewer = interview.profiles?.[0] || null
                const fallbackInterviewer = interview.interviewer_id
                  ? teamMemberMap.get(interview.interviewer_id) || null
                  : null
                const interviewerName =
                  relatedInterviewer?.full_name ||
                  fallbackInterviewer?.full_name ||
                  'Not assigned'

                return (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>

                      <div>
                        <Link
                          href={`/candidates/${interview.candidate_id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {getCandidateFullName(candidate)}
                        </Link>

                        <p className="text-sm text-muted-foreground">
                          {vacancy?.title || 'Unknown vacancy'}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Interviewer: {interviewerName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <p className="font-medium text-foreground">
                        {getTimeLabel(scheduledDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(scheduledDate, 'h:mm a')} ({interview.duration_minutes} min)
                      </p>
                      <Badge
                        variant="secondary"
                        className={`mt-1 capitalize ${getStatusColor(interview.status)}`}
                      >
                        {interview.status}
                      </Badge>
                      {interview.google_meet_link && (
                        <a
                          href={interview.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
                        >
                          <Video className="h-3 w-3" />
                          Join Meet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No upcoming interviews</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Schedule interviews with your candidates.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/interviews/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Interview
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {pastInterviews.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Past Interviews</CardTitle>
            <CardDescription>
              {pastInterviews.length} completed or cancelled interviews
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {pastInterviews.slice(0, 10).map((interview) => {
                const Icon = getInterviewIcon(interview.type)
                const scheduledDate = new Date(interview.scheduled_at)

                const relatedCandidate = interview.candidates?.[0] || null
                const fallbackCandidate = candidateMap.get(interview.candidate_id) || null
                const candidate = relatedCandidate || fallbackCandidate

                const relatedVacancy = interview.vacancies?.[0] || null
                const fallbackVacancy = vacancyMap.get(interview.vacancy_id) || null
                const vacancy = relatedVacancy || fallbackVacancy

                return (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between rounded-lg bg-muted/30 p-4 opacity-75"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>

                      <div>
                        <Link
                          href={`/candidates/${interview.candidate_id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {getCandidateFullName(candidate)}
                        </Link>

                        <p className="text-sm text-muted-foreground">
                          {vacancy?.title || 'Unknown vacancy'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(scheduledDate, 'MMM d, yyyy')}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`mt-1 capitalize ${getStatusColor(interview.status)}`}
                      >
                        {interview.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
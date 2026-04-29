import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Video, Phone, Building, ExternalLink } from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { FilterPillTabs } from '@/components/shared/filter-pill-tabs'

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
  meeting_link: string | null
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

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800',
}

function getCandidateFullName(candidate?: { first_name: string; last_name: string } | null) {
  if (!candidate) return 'Unknown candidate'
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

function getTimeLabel(date: Date) {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'MMM d, yyyy')
}

function getInterviewIcon(type: string) {
  switch (type) {
    case 'video': return Video
    case 'phone': return Phone
    case 'onsite': return Building
    default: return Calendar
  }
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFilter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
        id, candidate_id, vacancy_id, application_id, interviewer_id,
        scheduled_at, duration_minutes, type, status,
        google_meet_link, meeting_link,
        candidates ( id, first_name, last_name ),
        vacancies!inner ( id, title, organization_id ),
        profiles ( full_name )
      `)
      .eq('organization_id', organizationId)
      .order('scheduled_at', { ascending: false }),

    supabase.from('candidates').select('id, first_name, last_name')
      .eq('organization_id', organizationId).is('deleted_at', null),

    supabase.from('vacancies').select('id, title')
      .eq('organization_id', organizationId).is('archived_at', null),

    supabase.from('profiles').select('id, full_name')
      .eq('organization_id', organizationId).eq('is_active', true),
  ])

  const interviews = (interviewsRaw || []) as InterviewRow[]
  const candidates = (candidatesRaw || []) as CandidateOption[]
  const vacancies = (vacanciesRaw || []) as VacancyOption[]
  const teamMembers = (teamMembersRaw || []) as TeamMemberOption[]

  const candidateMap = new Map(candidates.map((c) => [c.id, c]))
  const vacancyMap = new Map(vacancies.map((v) => [v.id, v]))
  const teamMemberMap = new Map(teamMembers.map((m) => [m.id, m]))

  const scheduledCount = interviews.filter((i) => i.status === 'scheduled').length
  const completedCount = interviews.filter((i) => i.status === 'completed').length
  const cancelledCount = interviews.filter((i) => i.status === 'cancelled').length

  const filtered = statusFilter
    ? interviews.filter((i) => i.status === statusFilter)
    : interviews

  const filterTabs = [
    { value: 'all', label: 'All' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interviews</h1>
          <p className="text-muted-foreground">Schedule and manage candidate interviews.</p>
        </div>
        <Button asChild>
          <Link href="/interviews/new">
            <Plus className="mr-2 h-4 w-4" />
            Schedule Interview
          </Link>
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Scheduled', value: scheduledCount, color: 'text-primary' },
          { label: 'Completed', value: completedCount, color: 'text-success' },
          { label: 'Cancelled', value: cancelledCount, color: 'text-destructive' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card px-4 py-3.5"
          >
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <FilterPillTabs
        tabs={filterTabs}
        paramKey="status"
        activeValue={statusFilter || ''}
      />

      {/* Interview list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {filtered.map((interview) => {
            const Icon = getInterviewIcon(interview.type)
            const scheduledDate = new Date(interview.scheduled_at)

            const candidate =
              interview.candidates?.[0] ?? candidateMap.get(interview.candidate_id) ?? null
            const vacancy =
              interview.vacancies?.[0] ?? vacancyMap.get(interview.vacancy_id) ?? null
            const interviewerName =
              interview.profiles?.[0]?.full_name ??
              (interview.interviewer_id ? teamMemberMap.get(interview.interviewer_id)?.full_name : null) ??
              'Not assigned'

            return (
              <div
                key={interview.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/candidates/${interview.candidate_id}`}
                      className="text-sm font-semibold text-foreground hover:underline"
                    >
                      {getCandidateFullName(candidate)}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {vacancy?.title || 'Unknown vacancy'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      Interviewer: {interviewerName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {getTimeLabel(scheduledDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(scheduledDate, 'h:mm a')} ({interview.duration_minutes} min)
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge
                      variant="secondary"
                      className={`capitalize text-xs ${STATUS_COLORS[interview.status] ?? ''}`}
                    >
                      {interview.status.replace('_', ' ')}
                    </Badge>
                    {(interview.google_meet_link || interview.meeting_link) && (
                      <a
                        href={(interview.google_meet_link || interview.meeting_link)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <Video className="h-3 w-3" />
                        Join
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No interviews found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter ? 'Try a different filter.' : 'Schedule interviews with your candidates.'}
          </p>
          {!statusFilter && (
            <Button className="mt-6" asChild>
              <Link href="/interviews/new">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Interview
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

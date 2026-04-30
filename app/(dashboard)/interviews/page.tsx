import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Video, Phone, Building, ExternalLink } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { FilterPillTabs } from '@/components/shared/filter-pill-tabs'
import { InterviewActions } from '@/components/interviews/interview-actions'

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
        email: string | null
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

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800',
  past: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  no_show: 'bg-red-100 text-red-800',
}

function getDisplayStatus(interview: InterviewRow): string {
  if (interview.status === 'cancelled') return 'cancelled'
  if (interview.status === 'no_show') return 'no show'
  if (interview.status === 'completed') return 'completed'
  // status === 'scheduled' — derive upcoming vs past
  return isPast(new Date(interview.scheduled_at)) ? 'past' : 'upcoming'
}

function getDisplayStatusKey(interview: InterviewRow): string {
  if (interview.status === 'cancelled') return 'cancelled'
  if (interview.status === 'no_show') return 'no_show'
  if (interview.status === 'completed') return 'completed'
  return isPast(new Date(interview.scheduled_at)) ? 'past' : 'upcoming'
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

  const { data: interviewsRaw } = await supabase
    .from('interviews')
    .select(`
      id, candidate_id, vacancy_id, application_id, interviewer_id,
      scheduled_at, duration_minutes, type, status,
      google_meet_link, meeting_link,
      candidates ( id, first_name, last_name, email ),
      vacancies!inner ( id, title, organization_id ),
      profiles ( full_name )
    `)
    .eq('organization_id', organizationId)
    .order('scheduled_at', { ascending: false })

  const interviews = (interviewsRaw || []) as InterviewRow[]

  const now = new Date()
  const upcomingCount = interviews.filter(
    (i) => i.status === 'scheduled' && !isPast(new Date(i.scheduled_at))
  ).length
  const pastCount = interviews.filter(
    (i) => i.status === 'scheduled' && isPast(new Date(i.scheduled_at))
  ).length
  const cancelledCount = interviews.filter((i) => i.status === 'cancelled').length
  const noShowCount = interviews.filter((i) => i.status === 'no_show').length

  // Filter
  const filtered = (() => {
    if (!statusFilter) return interviews
    if (statusFilter === 'upcoming') return interviews.filter((i) => i.status === 'scheduled' && !isPast(new Date(i.scheduled_at)))
    if (statusFilter === 'past') return interviews.filter((i) => i.status === 'scheduled' && isPast(new Date(i.scheduled_at)))
    return interviews.filter((i) => i.status === statusFilter)
  })()

  const filterTabs = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: `Scheduled (${upcomingCount})` },
    { value: 'past', label: `Past (${pastCount})` },
    { value: 'cancelled', label: `Cancelled (${cancelledCount})` },
    { value: 'no_show', label: `No Show (${noShowCount})` },
  ]

  void now // suppress unused warning

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
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Scheduled', value: upcomingCount, color: 'text-primary' },
          { label: 'Past', value: pastCount, color: 'text-yellow-600' },
          { label: 'Cancelled', value: cancelledCount, color: 'text-muted-foreground' },
          { label: 'No Show', value: noShowCount, color: 'text-destructive' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card px-4 py-3.5">
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <FilterPillTabs tabs={filterTabs} paramKey="status" activeValue={statusFilter || ''} />

      {/* Interview list */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {filtered.map((interview) => {
            const Icon = getInterviewIcon(interview.type)
            const scheduledDate = new Date(interview.scheduled_at)
            const displayStatusKey = getDisplayStatusKey(interview)
            const displayStatusLabel = getDisplayStatus(interview)

            const candidate = interview.candidates?.[0] ?? null
            const vacancy = interview.vacancies?.[0] ?? null
            const interviewerName = interview.profiles?.[0]?.full_name ?? 'Not assigned'
            const candidateHasEmail = !!candidate?.email
            const meetLink = interview.google_meet_link || interview.meeting_link

            const isActionable = interview.status !== 'cancelled' && interview.status !== 'no_show' && interview.status !== 'completed'

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
                      className={`capitalize text-xs ${STATUS_COLORS[displayStatusKey] ?? ''}`}
                    >
                      {displayStatusLabel}
                    </Badge>
                    {meetLink && (
                      <a
                        href={meetLink}
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

                  {isActionable && (
                    <InterviewActions
                      interviewId={interview.id}
                      currentStatus={interview.status}
                      scheduledAt={interview.scheduled_at}
                      durationMinutes={interview.duration_minutes}
                      candidateHasEmail={candidateHasEmail}
                    />
                  )}
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

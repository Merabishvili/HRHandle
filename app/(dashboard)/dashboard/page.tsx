import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  Briefcase,
  Users,
  Calendar,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VACANCY_STATUS_COLORS } from '@/lib/types/vacancy'

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  general_status_id: string | null
  created_at: string
}

interface CandidateStatusRow {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
  is_active: boolean
  sort_order: number
}

interface VacancyStatusRow {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
}

interface VacancyRow {
  id: string
  title: string
  department: string | null
  location: string | null
  status_id: string | null
  created_at: string
  vacancy_statuses:
    | {
        id: string
        name: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
      }[]
    | null
}

interface RecentCandidateRow extends CandidateRow {
  linkedVacancyTitle?: string | null
}

interface InterviewRow {
  id: string
  candidate_id: string
  vacancy_id: string
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
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
      }[]
    | null
}

function getCandidateFullName(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

function getCandidateInitials(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}

export default async function DashboardPage() {
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

  const orgId = profile?.organization_id
  if (!orgId) return null

  const [
    { data: vacancyStatusesRaw },
    { data: candidateStatusesRaw },
    { count: totalVacancies },
    { count: totalCandidates },
    { count: activeApplications },
    { data: allVacanciesRaw },
    { data: allCandidatesRaw },
    { data: recentCandidatesRaw },
    { data: recentVacanciesRaw },
    { data: upcomingInterviewsRaw },
  ] = await Promise.all([
    supabase
      .from('vacancy_statuses')
      .select('id, name, code')
      .order('sort_order', { ascending: true }),

    supabase
      .from('candidate_statuses')
      .select('id, name, code')
      .order('sort_order', { ascending: true }),

    supabase
      .from('vacancies')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('archived_at', null),

    supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    // all vacancies — used for open-vacancy count and vacancy map for interview fallback
    supabase
      .from('vacancies')
      .select(`id, title, department, location, status_id, created_at, vacancy_statuses(id, name, code)`)
      .eq('organization_id', orgId)
      .is('archived_at', null),

    // all candidates (lightweight) — used for new-candidate count
    supabase
      .from('candidates')
      .select('id, general_status_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null),

    // recent 5 candidates
    supabase
      .from('candidates')
      .select(`
        id,
        first_name,
        last_name,
        current_position,
        current_company,
        general_status_id,
        created_at
      `)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('vacancies')
      .select(`id, title, department, location, status_id, created_at, vacancy_statuses(id, name, code)`)
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('interviews')
      .select(`
        id,
        candidate_id,
        vacancy_id,
        scheduled_at,
        status,
        candidates ( id, first_name, last_name ),
        vacancies ( id, title )
      `)
      .eq('organization_id', orgId)
      .gte('scheduled_at', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(5),
  ])

  const vacancyStatuses = (vacancyStatusesRaw || []) as VacancyStatusRow[]
  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusRow[]
  const allVacancies = (allVacanciesRaw || []) as VacancyRow[]
  const allCandidates = (allCandidatesRaw || []) as Pick<CandidateRow, 'id' | 'general_status_id'>[]
  const recentCandidatesBase = (recentCandidatesRaw || []) as CandidateRow[]
  const recentVacancies = (recentVacanciesRaw || []) as VacancyRow[]
  const upcomingInterviews = (upcomingInterviewsRaw || []) as InterviewRow[]

  // Fetch applications for recent candidates separately for reliability
  const recentCandidateIds = recentCandidatesBase.map((c) => c.id)
  const candidateVacancyMap = new Map<string, string>()
  if (recentCandidateIds.length > 0) {
    const { data: recentAppsRaw } = await supabase
      .from('applications')
      .select('candidate_id, vacancies(id, title)')
      .in('candidate_id', recentCandidateIds)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('applied_at', { ascending: false })

    type AppWithVacancy = { candidate_id: string; vacancies: { id: string; title: string } | { id: string; title: string }[] | null }
    const recentApps = (recentAppsRaw || []) as AppWithVacancy[]
    for (const app of recentApps) {
      if (!candidateVacancyMap.has(app.candidate_id) && app.vacancies) {
        const vacancy = Array.isArray(app.vacancies) ? app.vacancies[0] : app.vacancies
        if (vacancy?.title) candidateVacancyMap.set(app.candidate_id, vacancy.title)
      }
    }
  }

  const recentCandidates: RecentCandidateRow[] = recentCandidatesBase.map((c) => ({
    ...c,
    linkedVacancyTitle: candidateVacancyMap.get(c.id) ?? null,
  }))

  const vacancyStatusMap = new Map(vacancyStatuses.map((s) => [s.id, s]))
  const vacancyMap = new Map(allVacancies.map((v) => [v.id, v]))

  const openVacancyStatusId = vacancyStatuses.find((s) => s.code === 'open')?.id ?? null
  const activeCandidateStatusId = candidateStatuses.find((s) => s.code === 'active')?.id ?? null

  const activeVacancies = openVacancyStatusId
    ? allVacancies.filter((v) => v.status_id === openVacancyStatusId).length
    : 0

  const activeCandidates = activeCandidateStatusId
    ? allCandidates.filter((c) => c.general_status_id === activeCandidateStatusId).length
    : 0

  const stats = [
    {
      title: 'Total Vacancies',
      value: totalVacancies || 0,
      icon: Briefcase,
      change: `${activeVacancies} open`,
      href: '/vacancies',
    },
    {
      title: 'Total Candidates',
      value: totalCandidates || 0,
      icon: Users,
      change: `${activeCandidates} active`,
      href: '/candidates',
    },
    {
      title: 'Active Applications',
      value: activeApplications || 0,
      icon: Calendar,
      change: 'Across all vacancies',
      href: '/candidates',
    },
    {
      title: 'Hiring Rate',
      value: '---',
      icon: TrendingUp,
      change: 'Later metric',
      href: '/candidates',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your hiring activity.
          </p>
        </div>

        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            New Vacancy
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Candidates</CardTitle>
              <CardDescription>Latest candidates added to the system</CardDescription>
            </div>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/candidates">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {recentCandidates.length > 0 ? (
              <div className="space-y-4">
                {recentCandidates.map((candidate) => {
                  return (
                    <Link
                      key={candidate.id}
                      href={`/candidates/${candidate.id}`}
                      className="flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-medium text-primary">
                            {getCandidateInitials(candidate)}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getCandidateFullName(candidate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidate.linkedVacancyTitle ||
                              candidate.current_position ||
                              'No vacancy linked'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(candidate.created_at), { addSuffix: true })}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No candidates yet</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/candidates/new">Add candidate</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Vacancies</CardTitle>
              <CardDescription>Your latest job postings</CardDescription>
            </div>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/vacancies">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {recentVacancies.length > 0 ? (
              <div className="space-y-4">
                {recentVacancies.map((vacancy) => {
                  const relatedStatus = vacancy.vacancy_statuses?.[0] || null
                  const fallbackStatus = vacancy.status_id
                    ? vacancyStatusMap.get(vacancy.status_id) || null
                    : null
                  const status = relatedStatus || fallbackStatus || null

                  return (
                    <Link
                      key={vacancy.id}
                      href={`/vacancies/${vacancy.id}`}
                      className="flex items-center justify-between rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{vacancy.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {vacancy.department || 'No department'} • {vacancy.location || 'Remote'}
                        </p>
                      </div>

                      {status ? (
                        <Badge
                          variant="secondary"
                          className={VACANCY_STATUS_COLORS[status.code]}
                        >
                          {status.name}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unknown</Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No vacancies yet</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/vacancies/new">Create vacancy</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Interviews</CardTitle>
              <CardDescription>Scheduled interviews for the coming days</CardDescription>
            </div>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/interviews">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {upcomingInterviews.length > 0 ? (
              <div className="space-y-4">
                {upcomingInterviews.map((interview) => {
                  const candidate = interview.candidates?.[0] ?? null
                  const vacancy = interview.vacancies?.[0] ?? vacancyMap.get(interview.vacancy_id) ?? null

                  return (
                    <Link
                      key={interview.id}
                      href={`/candidates/${interview.candidate_id}`}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted"
                    >

                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {candidate
                              ? `${candidate.first_name} ${candidate.last_name}`
                              : 'Unknown candidate'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {vacancy?.title || 'Unknown vacancy'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {new Date(interview.scheduled_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(interview.scheduled_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No upcoming interviews</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
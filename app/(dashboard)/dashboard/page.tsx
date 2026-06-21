import { createClient } from '@/lib/supabase/server'
import { getVacancyStatuses, getCandidateStatuses } from '@/lib/cache/lookups'
import Link from 'next/link'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import {
  Briefcase,
  Users,
  Calendar,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
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

import type { CandidateStatusOption as CandidateStatusRow } from '@/lib/types/database'

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

  const [vacancyStatusesRaw, candidateStatusesRaw] = await Promise.all([
    getVacancyStatuses(),
    getCandidateStatuses(),
  ])

  const [
    { count: totalVacancies },
    { count: totalCandidates },
    { count: activeApplications },
    { data: allVacanciesRaw },
    { data: allCandidatesRaw },
    { data: recentCandidatesRaw },
    { data: recentVacanciesRaw },
    { data: upcomingInterviewsRaw },
    { data: pendingOffersRaw },
    { count: newApplicantsCount },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .is('deleted_at', null),

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
      .is('archived_at', null)
      .is('deleted_at', null),

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
      .is('deleted_at', null)
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

    // Wave 2.11 / A-1 — cross-vacancy "needs your attention" sources.
    // Pending offers = sent + still awaiting a response (not declined,
    // accepted, withdrawn, or expired). The candidate row carries the
    // first name + initials we render in the tile.
    supabase
      .from('offers')
      .select(`
        id, application_id, sent_at,
        applications ( candidate_id, candidates ( id, first_name, last_name ) )
      `)
      .eq('organization_id', orgId)
      .eq('status', 'sent')
      .is('responded_at', null)
      .is('deleted_at', null)
      .order('sent_at', { ascending: true })
      .limit(5),

    // New applicants in the last 48h — for the "N new applicants" row.
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('applied_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
  ])

  const vacancyStatuses = (vacancyStatusesRaw || []) as VacancyStatusRow[]
  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusRow[]
  const allVacancies = (allVacanciesRaw || []) as VacancyRow[]
  const allCandidates = (allCandidatesRaw || []) as Pick<CandidateRow, 'id' | 'general_status_id'>[]
  const recentCandidatesBase = (recentCandidatesRaw || []) as CandidateRow[]
  const recentVacancies = (recentVacanciesRaw || []) as VacancyRow[]
  const upcomingInterviews = (upcomingInterviewsRaw || []) as InterviewRow[]

  // Fetch candidate names for upcoming interviews separately (embedded joins are unreliable with RLS)
  const interviewCandidateIds = [...new Set(upcomingInterviews.map((i) => i.candidate_id))]
  const interviewCandidateMap = new Map<string, { first_name: string; last_name: string }>()
  if (interviewCandidateIds.length > 0) {
    const { data: interviewCandidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name')
      .in('id', interviewCandidateIds)
      .eq('organization_id', orgId)
    for (const c of (interviewCandidatesRaw || [])) {
      interviewCandidateMap.set(c.id, { first_name: c.first_name, last_name: c.last_name })
    }
  }

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
      title: 'Total vacancies',
      value: totalVacancies || 0,
      icon: Briefcase,
      change: `${activeVacancies} open`,
      href: '/vacancies',
    },
    {
      title: 'Total candidates',
      value: totalCandidates || 0,
      icon: Users,
      change: `${activeCandidates} active`,
      href: '/candidates',
    },
    {
      title: 'Active candidates',
      value: activeApplications || 0,
      icon: Calendar,
      change: 'Across all vacancies',
      href: '/candidates',
    },
  ]

  // Wave 2.11 / A-1 — cross-vacancy "Needs your attention" list. Same
  // idiom as the Vacancy Detail Overview rail, just aggregated across
  // every open role: pending offers awaiting reply, interviews in the
  // next 24h, and a "N new applicants to review" prompt when new apps
  // arrived in the last 48h. Renders inline so we don't have to extract
  // a shared component yet.
  type PendingOfferJoin = {
    id: string
    application_id: string | null
    sent_at: string | null
    applications:
      | { candidate_id: string; candidates: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null }
      | { candidate_id: string; candidates: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null }[]
      | null
  }
  const pendingOffersRows = (pendingOffersRaw ?? []) as PendingOfferJoin[]
  const now = new Date()
  const next24hLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  interface AttentionTileRow {
    id: string
    initials: string
    hue: 'cyan' | 'purple' | 'blue'
    message: React.ReactNode
    ctaLabel: string
    ctaHref: string
  }
  const attentionItems: AttentionTileRow[] = []

  for (const o of pendingOffersRows) {
    const appJoin = Array.isArray(o.applications) ? o.applications[0] : o.applications
    const candJoin = appJoin?.candidates
    const cand = Array.isArray(candJoin) ? candJoin[0] : candJoin
    if (!cand) continue
    const daysAwaiting = o.sent_at
      ? Math.max(0, differenceInDays(now, new Date(o.sent_at)))
      : 0
    attentionItems.push({
      id: `offer-${o.id}`,
      initials: `${cand.first_name?.[0] ?? ''}${cand.last_name?.[0] ?? ''}`.toUpperCase() || '?',
      hue: 'cyan',
      message: (
        <>
          {cand.first_name}&rsquo;s offer awaiting reply{' '}
          <strong className="font-semibold">
            {daysAwaiting === 0 ? 'today' : `${daysAwaiting}d`}
          </strong>
        </>
      ),
      ctaLabel: 'Follow up →',
      ctaHref: `/candidates/${cand.id}`,
    })
  }

  for (const i of upcomingInterviews) {
    const scheduledAt = new Date(i.scheduled_at)
    if (scheduledAt > next24hLimit) continue
    const candJoin = i.candidates
    const cand = Array.isArray(candJoin) ? candJoin[0] : candJoin
    if (!cand) continue
    attentionItems.push({
      id: `interview-${i.id}`,
      initials: `${cand.first_name?.[0] ?? ''}${cand.last_name?.[0] ?? ''}`.toUpperCase() || '?',
      hue: 'purple',
      message: (
        <>
          Interview with {cand.first_name}{' '}
          <strong className="font-semibold">
            {formatDistanceToNow(scheduledAt, { addSuffix: true })}
          </strong>
        </>
      ),
      ctaLabel: 'View →',
      ctaHref: `/interviews`,
    })
  }

  if ((newApplicantsCount ?? 0) > 0) {
    attentionItems.push({
      id: 'new-applicants',
      initials: `+${newApplicantsCount}`,
      hue: 'blue',
      message: (
        <>
          <strong className="font-semibold">
            {newApplicantsCount} new {newApplicantsCount === 1 ? 'applicant' : 'applicants'}
          </strong>{' '}
          to review (last 48h)
        </>
      ),
      ctaLabel: 'Review →',
      ctaHref: '/pipeline',
    })
  }

  function attentionInitialsStyle(hue: AttentionTileRow['hue']): React.CSSProperties {
    switch (hue) {
      case 'cyan':
        return { background: 'oklch(0.94 0.06 200)', color: 'oklch(0.42 0.13 200)' }
      case 'purple':
        return { background: 'oklch(0.93 0.06 300)', color: 'oklch(0.45 0.15 300)' }
      case 'blue':
        return { background: 'oklch(0.93 0.05 250)', color: 'oklch(0.42 0.16 250)' }
    }
  }

  return (
    <div className="space-y-6">
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
            New vacancy
          </Link>
        </Button>
      </div>

      {/* Wave 2.11 / A-1 — Needs your attention (cross-vacancy) */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <AlertTriangle
            className="h-4 w-4"
            style={{ color: 'oklch(0.5 0.12 60)' }}
            aria-hidden
          />
          <CardTitle className="text-[15px] font-bold">
            Needs your attention
            {attentionItems.length > 0 && (
              <span className="ml-1.5 text-muted-foreground">· {attentionItems.length}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {attentionItems.length === 0 ? (
            <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-[12.5px] text-muted-foreground">
              Nothing&rsquo;s blocking you today. Open the pipeline below to drive next moves.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {attentionItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-[9px] border border-border bg-white px-3 py-2.5"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                    style={attentionInitialsStyle(item.hue)}
                    aria-hidden
                  >
                    {item.initials}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] text-foreground/85">
                    {item.message}
                  </span>
                  <Link
                    href={item.ctaHref}
                    className="shrink-0 text-[12px] font-semibold text-[oklch(0.55_0.18_250)] hover:underline"
                  >
                    {item.ctaLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <CardTitle>Recent candidates</CardTitle>
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
              <CardTitle>Recent vacancies</CardTitle>
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
                          {vacancy.department || 'No department'} · {vacancy.location || 'Remote'}
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
              <CardTitle>Upcoming interviews</CardTitle>
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
                  const candidate = interview.candidates?.[0] ?? interviewCandidateMap.get(interview.candidate_id) ?? null
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
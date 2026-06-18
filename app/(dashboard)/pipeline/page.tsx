import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, BarChart3, Briefcase, Users, Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getApplicationStatuses, getVacancyStatuses } from '@/lib/cache/lookups'
import type { ApplicationStatus } from '@/lib/types/application'
import { CrossVacancyBoard, type CrossVacancyApplication } from '@/components/pipeline/cross-vacancy-board'
import type { RoleOption } from '@/components/pipeline/role-filter-dropdown'

/**
 * Top-level `/pipeline` route — Wave 2.1.
 *
 * Two scenarios:
 *
 *   1. Org has zero non-archived vacancies → render the welcome card from
 *      `redesign/Pipeline Empty State.dc.html` (locked per Q-S01-e). One
 *      primary CTA ("Create your first vacancy"), one secondary ("Import
 *      candidates"), plus a 3-step orientation strip.
 *
 *   2. Org has at least one vacancy → render the cross-vacancy kanban
 *      (`CrossVacancyBoard`) with role filter dropdown, terminal-stage
 *      rail, and Review mode entry. Cards span every active vacancy
 *      grouped by global application status.
 *
 * The board itself is a client component because of DnD + Review-mode
 * keyboard state; this server component is the data-fetch boundary.
 */
const TERMINAL_CODES: ReadonlySet<ApplicationStatus['code']> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

export default async function PipelinePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const orgId = profile.organization_id

  // Only "open" vacancies belong on the cross-vacancy board — on-hold /
  // closed / draft roles aren't where the working surface lives. This
  // matches what the per-vacancy `/vacancies/[id]/pipeline` route renders.
  const [vacancyStatusesRaw, appStatusesRaw] = await Promise.all([
    getVacancyStatuses(),
    getApplicationStatuses(),
  ])

  const vacancyStatuses = (vacancyStatusesRaw || []) as { id: string; code: string }[]
  const openVacancyStatusId = vacancyStatuses.find((s) => s.code === 'open')?.id ?? null

  let vacanciesQuery = supabase
    .from('vacancies')
    .select('id, title, department, location')
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (openVacancyStatusId) {
    vacanciesQuery = vacanciesQuery.eq('status_id', openVacancyStatusId)
  }

  const { data: vacanciesRaw } = await vacanciesQuery
  const vacancies = (vacanciesRaw ?? []) as {
    id: string
    title: string
    department: string | null
    location: string | null
  }[]

  // 0 vacancies — render the welcome card per Q-S01-e
  if (vacancies.length === 0) {
    return (
      <div className="relative -mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden lg:-mx-8 lg:-my-8">
        <div className="relative z-10 mx-auto w-full max-w-[560px] px-6 text-center">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-9 w-9 text-primary" />
          </div>
          <h2 className="text-[26px] font-bold leading-tight text-foreground">
            Welcome to HRHandle <Sparkles className="inline h-6 w-6 text-amber-500" />
          </h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[15.5px] leading-relaxed text-muted-foreground">
            This is your pipeline — every candidate across every role, in one
            place. To get started, create your first vacancy and your board
            comes to life.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/vacancies/new">
                <Plus className="h-4 w-4" />
                Create your first vacancy
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/candidates/import">
                <Upload className="h-4 w-4" />
                Import candidates
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            {[
              { n: 1, icon: Briefcase, title: 'Create a vacancy', body: 'Add the role, let AI draft the description, set a scorecard.' },
              { n: 2, icon: Users,     title: 'Add candidates',   body: 'Share the apply link or upload CVs — they land here automatically.' },
              { n: 3, icon: BarChart3, title: 'Work the pipeline',body: 'Move people through stages, score interviews, send offers.' },
            ].map((step) => {
              const Icon = step.icon
              return (
                <div key={step.n} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {step.n}
                    </span>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{step.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // 1+ vacancies — fetch the kanban data set.
  const vacancyIds = vacancies.map((v) => v.id)
  const appStatuses = (appStatusesRaw || []).filter((s) => s.is_active) as ApplicationStatus[]
  const sortedStatuses = [...appStatuses].sort((a, b) => a.sort_order - b.sort_order)

  const [
    { data: applicationsRaw },
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
  ] = await Promise.all([
    supabase
      .from('applications')
      .select('id, candidate_id, vacancy_id, status_id, applied_at, last_status_changed_at')
      .eq('organization_id', orgId)
      .in('vacancy_id', vacancyIds)
      .is('deleted_at', null)
      .order('applied_at', { ascending: false }),

    supabase
      .from('rejection_reasons')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('rejection_templates')
      .select('id, name, subject, body, reason_id')
      .eq('organization_id', orgId)
      .order('sort_order', { ascending: true }),
  ])

  interface AppRow {
    id: string
    candidate_id: string
    vacancy_id: string
    status_id: string | null
    applied_at: string
    last_status_changed_at: string | null
  }
  const appRows = (applicationsRaw ?? []) as AppRow[]

  // Fetch candidates separately (the nested join is unreliable for null
  // and deleted candidate cases).
  const candidateIds = [...new Set(appRows.map((a) => a.candidate_id))]
  const candidateMap = new Map<
    string,
    { id: string; first_name: string; last_name: string; current_position: string | null; current_company: string | null }
  >()
  if (candidateIds.length > 0) {
    const { data: candidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, current_position, current_company')
      .in('id', candidateIds)
      .is('deleted_at', null)
    for (const c of candidatesRaw ?? []) candidateMap.set(c.id, c)
  }

  const vacancyMap = new Map(vacancies.map((v) => [v.id, v]))
  const firstStatusId = sortedStatuses[0]?.id ?? null

  const applications: CrossVacancyApplication[] = appRows
    .map((a) => {
      const candidate = candidateMap.get(a.candidate_id)
      const vacancy = vacancyMap.get(a.vacancy_id)
      if (!candidate || !vacancy) return null
      return {
        id: a.id,
        candidate_id: a.candidate_id,
        status_id: a.status_id ?? firstStatusId,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        current_position: candidate.current_position,
        current_company: candidate.current_company,
        last_status_changed_at: a.last_status_changed_at,
        applied_at: a.applied_at,
        vacancy_id: a.vacancy_id,
        vacancy_title: vacancy.title,
      } satisfies CrossVacancyApplication
    })
    .filter((a): a is CrossVacancyApplication => a !== null)

  // Active-count per vacancy for the role filter dropdown — "active" =
  // non-terminal applications. Recruiter sees which roles are alive.
  const roleOptions: RoleOption[] = vacancies.map((v) => {
    const activeCount = applications.filter((a) => {
      if (a.vacancy_id !== v.id) return false
      const status = sortedStatuses.find((s) => s.id === a.status_id)
      return !!status && !TERMINAL_CODES.has(status.code)
    }).length
    return { id: v.id, title: v.title, activeCount }
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground">
            {vacancies.length} active {vacancies.length === 1 ? 'role' : 'roles'} ·{' '}
            {applications.length} candidate{applications.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            New vacancy
          </Link>
        </Button>
      </div>

      <CrossVacancyBoard
        statuses={sortedStatuses}
        roles={roleOptions}
        initialApplications={applications}
        rejectionReasons={rejectionReasonsRaw ?? []}
        rejectionTemplates={rejectionTemplatesRaw ?? []}
      />
    </div>
  )
}

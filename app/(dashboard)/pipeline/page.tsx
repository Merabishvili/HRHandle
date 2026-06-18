import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, BarChart3, Briefcase, Users, Sparkles, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getApplicationStatuses, getVacancyStatuses } from '@/lib/cache/lookups'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import type { ApplicationStatus } from '@/lib/types/application'
import { cn } from '@/lib/utils'

/**
 * Top-level /pipeline route — Wave 2.1 scaffolding.
 *
 * The full global Pipeline (cross-vacancy kanban + role chips + Review mode)
 * is Wave 2.1's big-ticket item and is not yet built. Until it lands, this
 * route serves three scenarios:
 *
 *   1. Recruiter has zero non-archived vacancies → render the welcome card
 *      from `redesign/Pipeline Empty State.dc.html` (locked per Q-S01-e).
 *      One primary CTA ("Create your first vacancy"), one secondary
 *      ("Import candidates" — links to the CSV import wizard), plus a
 *      3-step orientation strip.
 *
 *   2. Recruiter has at least one vacancy → render a Pipeline OVERVIEW —
 *      a vacancy-keyed table where each row shows the title + a compact
 *      per-stage count strip + a "View pipeline" link to the existing
 *      `/vacancies/[id]/pipeline` board. This is a proper destination
 *      that explains the IA ("here are your role pipelines") instead of
 *      silently redirecting away (the previous behaviour created
 *      breadcrumb dissonance — the user clicked "Pipeline" in the
 *      sidebar but landed on a page that said "HRHandle › Vacancies").
 *
 *   3. The real cross-vacancy kanban (Wave 2.1 full) replaces this
 *      overview when it's built — same route, same nav entry, just a
 *      richer rendering inside.
 */
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

  const [vacancyStatusesRaw, appStatusesRaw, { data: vacanciesRaw }] = await Promise.all([
    getVacancyStatuses(),
    getApplicationStatuses(),
    supabase
      .from('vacancies')
      .select('id, title, department, location, status_id, application_form_token')
      .eq('organization_id', orgId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const vacancyStatuses = (vacancyStatusesRaw || []) as { id: string; code: string; name: string }[]
  const appStatuses = (appStatusesRaw || []) as ApplicationStatus[]

  interface VacancyRow {
    id: string
    title: string
    department: string | null
    location: string | null
    status_id: string | null
    application_form_token: string | null
  }
  const vacancies = (vacanciesRaw ?? []) as VacancyRow[]

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

  // 1+ vacancies — fetch live application counts grouped by (vacancy, status)
  const vacancyIds = vacancies.map((v) => v.id)
  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select('vacancy_id, status_id')
    .eq('organization_id', orgId)
    .in('vacancy_id', vacancyIds)
    .is('deleted_at', null)

  const apps = (applicationsRaw ?? []) as { vacancy_id: string; status_id: string | null }[]

  // counts[vacancyId][statusId] = N
  const counts = new Map<string, Map<string, number>>()
  for (const v of vacancies) counts.set(v.id, new Map())
  for (const a of apps) {
    if (!a.status_id) continue
    const inner = counts.get(a.vacancy_id)
    if (!inner) continue
    inner.set(a.status_id, (inner.get(a.status_id) ?? 0) + 1)
  }

  // Non-terminal stages drive the inline funnel. Terminal stages (rejected /
  // withdrawn / hired) sum into a small tail count.
  const TERMINAL_CODES = new Set(['rejected', 'withdrawn', 'hired'])
  const funnelStages = appStatuses
    .filter((s) => s.is_active && !TERMINAL_CODES.has(s.code))
    .sort((a, b) => a.sort_order - b.sort_order)
  const terminalIds = new Set(
    appStatuses.filter((s) => TERMINAL_CODES.has(s.code)).map((s) => s.id),
  )
  const hiredId = appStatuses.find((s) => s.code === 'hired')?.id ?? null

  const vacancyStatusMap = new Map(vacancyStatuses.map((s) => [s.id, s]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground">
            Every active role and where its candidates sit. Open a row for the full board.
          </p>
        </div>
        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            New vacancy
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Role</span>
          <span>Stage counts</span>
          <span className="sr-only">Open</span>
        </div>
        <ul className="divide-y divide-border">
          {vacancies.map((v) => {
            const inner = counts.get(v.id) ?? new Map()
            const total = Array.from(inner.values()).reduce((s, n) => s + n, 0)
            const hiredCount = hiredId ? inner.get(hiredId) ?? 0 : 0
            const terminalCount = Array.from(inner.entries())
              .filter(([id]) => terminalIds.has(id))
              .reduce((s, [, n]) => s + n, 0)
            const activeCount = total - terminalCount
            const status = v.status_id ? vacancyStatusMap.get(v.status_id) : null

            return (
              <li
                key={v.id}
                className="grid grid-cols-1 items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/vacancies/${v.id}/pipeline`}
                    className="text-[15px] font-semibold text-foreground hover:underline"
                  >
                    {v.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {/* Vacancy status is suppressed when it's the default 'open' —
                        every row in this list is non-archived, so labeling them
                        all "Open" is noise that collides with the "Open" button. */}
                    {(!status || status.code !== 'open') && (
                      <span className="capitalize">{status?.name ?? 'Draft'} · </span>
                    )}
                    {v.department && <>{v.department} · </>}
                    {v.location && <>{v.location} · </>}
                    {activeCount} active
                    {hiredCount > 0 && <> · {hiredCount} hired</>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {funnelStages.map((s) => {
                    const c = inner.get(s.id) ?? 0
                    return (
                      <span
                        key={s.id}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
                          c > 0 ? APPLICATION_STATUS_COLORS[s.code] : 'bg-muted text-muted-foreground/60',
                        )}
                      >
                        {s.name} {c}
                      </span>
                    )
                  })}
                  {hiredCount > 0 && (
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
                        APPLICATION_STATUS_COLORS['hired'],
                      )}
                    >
                      Hired {hiredCount}
                    </span>
                  )}
                </div>

                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/vacancies/${v.id}/pipeline`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        A cross-vacancy kanban view is on the roadmap. Until then, open any
        role above to work its pipeline.
      </p>
    </div>
  )
}

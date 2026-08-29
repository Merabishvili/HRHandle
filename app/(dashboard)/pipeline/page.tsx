import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Plus, Upload, BarChart3, Briefcase, Users, Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getApplicationStatuses, getVacancyStatuses } from '@/lib/cache/lookups'
import type { ApplicationStatus } from '@/lib/types/application'
import {
  CrossVacancyBoard,
  type CrossVacancyApplication,
} from '@/components/pipeline/cross-vacancy-board'
import type { RoleOption } from '@/components/pipeline/role-filter-pills'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { shortSourceLabel } from '@/lib/pipeline/source-label'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { localizeRejectionTemplateRow } from '@/lib/email-template-utils'

/**
 * Top-level `/pipeline` route — Wave 2.1 Version B.
 *
 * Two scenarios:
 *
 *   1. Org has zero non-archived vacancies → render the welcome card from
 *      `redesign/Pipeline Empty State.dc.html` (locked per Q-S01-e).
 *
 *   2. Org has at least one vacancy → render the colour-coded cross-vacancy
 *      kanban (`CrossVacancyBoard`) with Board/List toggle, density toggle,
 *      role filter, terminal rail, bulk bar, and Review mode entry. The
 *      board owns its own header now (matches `Pipeline Versions.dc.html`).
 */
const TERMINAL_CODES: ReadonlySet<ApplicationStatus['code']> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

export default async function PipelinePage() {
  const t = await getTranslations()
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

  if (!profile?.organization_id) redirect('/pipeline')

  const orgId = profile.organization_id

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

  if (vacancies.length === 0) {
    return (
      <div className="relative -mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden lg:-mx-8 lg:-my-8">
        <div className="relative z-10 mx-auto w-full max-w-[560px] px-6 text-center">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-9 w-9 text-primary" />
          </div>
          <h2 className="text-[26px] font-bold leading-tight text-foreground">
            {t('pipeline.empty.title')} <Sparkles className="inline h-6 w-6 text-amber-500" />
          </h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[15.5px] leading-relaxed text-muted-foreground">
            {t('pipeline.empty.body')}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/vacancies/new">
                <Plus className="h-4 w-4" />
                {t('pipeline.empty.createVacancy')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/candidates/import">
                <Upload className="h-4 w-4" />
                {t('pipeline.empty.importCandidates')}
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
            {[
              { n: 1, icon: Briefcase, title: t('pipeline.empty.step1Title'), body: t('pipeline.empty.step1Body') },
              { n: 2, icon: Users,     title: t('pipeline.empty.step2Title'), body: t('pipeline.empty.step2Body') },
              { n: 3, icon: BarChart3, title: t('pipeline.empty.step3Title'), body: t('pipeline.empty.step3Body') },
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

  const vacancyIds = vacancies.map((v) => v.id)
  const appStatuses = (appStatusesRaw || []).filter((s) => s.is_active) as ApplicationStatus[]
  const sortedStatuses = [...appStatuses].sort((a, b) => a.sort_order - b.sort_order)

  const [
    { data: applicationsRaw },
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
    { data: templatesRaw },
  ] = await Promise.all([
    // Wave 2.6 Slice 4 — applications.status_id is gone; we read
    // pipeline_stage_id + the joined pipeline_stages row (incl. its
    // origin_template_id link), then place each app on a Main-pipeline
    // column below.
    supabase
      .from('applications')
      .select(
        `id, candidate_id, vacancy_id, pipeline_stage_id, applied_at, last_status_changed_at,
         rejection_reason_id,
         pipeline_stages ( type, name, is_terminal, origin_template_id )`,
      )
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

    // Main pipeline (org-level stage templates) — these render the board
    // columns. Empty for orgs with no Main pipeline → canonical fallback.
    supabase
      .from('org_pipeline_stage_templates')
      .select('id, name, type, is_terminal, sort_order')
      .eq('organization_id', orgId)
      .order('sort_order', { ascending: true }),
  ])

  type StageRow = {
    type: 'standard' | 'review' | 'interview' | 'offer'
    name: string
    is_terminal: boolean
    origin_template_id: string | null
  }
  type StageJoin = StageRow | StageRow[] | null
  interface AppRow {
    id: string
    candidate_id: string
    vacancy_id: string
    pipeline_stage_id: string | null
    applied_at: string
    last_status_changed_at: string | null
    rejection_reason_id: string | null
    pipeline_stages: StageJoin
  }
  const appRows = (applicationsRaw ?? []) as AppRow[]
  const candidateIds = [...new Set(appRows.map((a) => a.candidate_id))]

  const [candidateMap, fitScoreMap] = await Promise.all([
    (async () => {
      if (candidateIds.length === 0) return new Map<string, CandidateRow>()
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, email, current_position, current_company, source')
        .in('id', candidateIds)
        .is('deleted_at', null)
      const m = new Map<string, CandidateRow>()
      for (const c of (data ?? []) as CandidateRow[]) m.set(c.id, c)
      return m
    })(),
    (async () => {
      const m = new Map<string, number>()
      const ids = appRows.map((a) => a.id)
      if (ids.length === 0) return m
      // Fit score = average of *submitted* reviewer cards per application.
      const { data } = await supabase
        .from('candidate_evaluations')
        .select('application_id, score')
        .eq('submitted', true)
        .in('application_id', ids)
      const agg = new Map<string, { total: number; count: number }>()
      for (const row of (data ?? []) as { application_id: string; score: number | null }[]) {
        if (typeof row.score === 'number') {
          const cur = agg.get(row.application_id) ?? { total: 0, count: 0 }
          cur.total += row.score
          cur.count += 1
          agg.set(row.application_id, cur)
        }
      }
      for (const [appId, { total, count }] of agg) m.set(appId, Math.round(total / count))
      return m
    })(),
  ])

  const vacancyMap = new Map(vacancies.map((v) => [v.id, v]))
  const firstStatusId = sortedStatuses[0]?.id ?? null

  // Reason-name lookup for closed (rejected) applications — surfaced in the
  // collapsed terminal rail's expanded list. The reasons are already fetched
  // above for the rejection dialog, so this is a free in-memory join.
  const reasonNameById = new Map<string, string>()
  for (const r of (rejectionReasonsRaw ?? []) as { id: string; name: string }[]) {
    reasonNameById.set(r.id, r.name)
  }

  const statusIdByCode = new Map<string, string>()
  for (const s of sortedStatuses) statusIdByCode.set(s.code, s.id)
  // Some terminal statuses (rejected / withdrawn) live outside
  // `sortedStatuses` because they're filtered to active. Pull them in too.
  for (const s of appStatuses) statusIdByCode.set(s.code, s.id)

  // Rejection still keys off the canonical application_statuses.id.
  const rejectedStatusId = statusIdByCode.get('rejected') ?? null

  // Board columns come from the org's Main pipeline (org_pipeline_stage_templates),
  // rendered as synthetic ApplicationStatus rows (id = template id = column key,
  // code = canonical bucket for colour/terminal semantics, name = custom label).
  // Orgs with no Main pipeline fall back to the canonical 7 statuses.
  const templates = (templatesRaw ?? []) as {
    id: string
    name: string
    type: 'standard' | 'review' | 'interview' | 'offer'
    is_terminal: boolean
    sort_order: number
  }[]
  const useTemplates = templates.length > 0

  const boardStatuses: ApplicationStatus[] = useTemplates
    ? [...templates]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((tpl) => ({
          id: tpl.id,
          name: tpl.name,
          code: mapPipelineStageToBucket({
            type: tpl.type,
            name: tpl.name,
            is_terminal: tpl.is_terminal,
          }) as ApplicationStatus['code'],
          is_active: true,
          sort_order: tpl.sort_order,
        }))
    : sortedStatuses

  const boardStatusById = new Map(boardStatuses.map((s) => [s.id, s]))
  const firstColumnId = boardStatuses[0]?.id ?? firstStatusId
  // First column per canonical bucket — where a vacancy-only stage (no
  // origin link) lands on the board.
  const firstColumnIdByBucket = new Map<string, string>()
  for (const s of boardStatuses) {
    if (!firstColumnIdByBucket.has(s.code)) firstColumnIdByBucket.set(s.code, s.id)
  }

  // Place each application on a board column. Prefer the origin link
  // (the exact Main-pipeline stage the app's per-vacancy stage was seeded
  // from); fall back to the canonical bucket for vacancy-only / unlinked
  // stages, then to the first column.
  function resolveColumnId(a: AppRow): string | null {
    const stageJoin = a.pipeline_stages
    const stageRow = Array.isArray(stageJoin) ? stageJoin[0] : stageJoin
    if (!stageRow) return firstColumnId
    if (useTemplates) {
      const origin = stageRow.origin_template_id
      if (origin && boardStatusById.has(origin)) return origin
      const bucket = mapPipelineStageToBucket(stageRow)
      return firstColumnIdByBucket.get(bucket) ?? firstColumnId
    }
    const bucket = mapPipelineStageToBucket(stageRow)
    return statusIdByCode.get(bucket) ?? firstColumnId
  }

  const applications: CrossVacancyApplication[] = appRows
    .map((a) => {
      const candidate = candidateMap.get(a.candidate_id)
      const vacancy = vacancyMap.get(a.vacancy_id)
      if (!candidate || !vacancy) return null
      // Convert the 0-100 internal scorecard percentage to the 0-10 design
      // pill format (e.g. 84 → 8.4). Null when no evaluation exists yet.
      const rawScore = fitScoreMap.get(a.id)
      const fitScore = typeof rawScore === 'number' ? Math.round(rawScore) / 10 : null

      return {
        id: a.id,
        candidate_id: a.candidate_id,
        status_id: resolveColumnId(a),
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        current_position: candidate.current_position,
        current_company: candidate.current_company,
        last_status_changed_at: a.last_status_changed_at,
        applied_at: a.applied_at,
        vacancy_id: a.vacancy_id,
        vacancy_title: vacancy.title,
        source: shortSourceLabel(candidate.source),
        fit_score: fitScore,
        rejection_reason: a.rejection_reason_id
          ? reasonNameById.get(a.rejection_reason_id) ?? null
          : null,
      } satisfies CrossVacancyApplication
    })
    .filter((a): a is CrossVacancyApplication => a !== null)

  const roleOptions: RoleOption[] = vacancies.map((v) => {
    const activeCount = applications.filter((a) => {
      if (a.vacancy_id !== v.id) return false
      const status = a.status_id ? boardStatusById.get(a.status_id) : null
      return !!status && !TERMINAL_CODES.has(status.code)
    }).length
    return { id: v.id, title: v.title, activeCount }
  })

  // Localize seeded default rejection templates so the reject-dialog preview
  // matches the (already-localized) email that gets sent (#3).
  const orgContentLocale = await fetchOrgContentLocale(supabase, orgId)
  const rejectionTemplates = (rejectionTemplatesRaw ?? []).map((tpl) =>
    localizeRejectionTemplateRow(tpl, orgContentLocale),
  )

  return (
    <div className="flex flex-col gap-4 pb-24">
      <CrossVacancyBoard
        statuses={boardStatuses}
        roles={roleOptions}
        initialApplications={applications}
        rejectionReasons={rejectionReasonsRaw ?? []}
        rejectionTemplates={rejectionTemplates}
        rejectedStatusId={rejectedStatusId}
      />
    </div>
  )
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  current_position: string | null
  current_company: string | null
  source: string | null
}

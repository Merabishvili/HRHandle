import { redirect } from 'next/navigation'
import Link from 'next/link'
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

/** Map the raw values stored in candidates.source to a short label that
 * fits the card design ("1d · LinkedIn", "2d · Apply link"). */
function shortSourceLabel(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^public apply/i.test(trimmed)) return 'Apply link'
  if (/^company website/i.test(trimmed)) return 'Website'
  if (/^job board/i.test(trimmed)) return 'Job board'
  if (/^csv import/i.test(trimmed)) return 'CSV'
  if (/^manual/i.test(trimmed)) return 'Manual'
  return trimmed
}

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

  const vacancyIds = vacancies.map((v) => v.id)
  const appStatuses = (appStatusesRaw || []).filter((s) => s.is_active) as ApplicationStatus[]
  const sortedStatuses = [...appStatuses].sort((a, b) => a.sort_order - b.sort_order)

  const [
    { data: applicationsRaw },
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
  ] = await Promise.all([
    // Wave 2.6 Slice 4 — applications.status_id is gone; we read
    // pipeline_stage_id + the joined pipeline_stages row, then bucket-
    // map each app to a canonical column code.
    supabase
      .from('applications')
      .select(
        `id, candidate_id, vacancy_id, pipeline_stage_id, applied_at, last_status_changed_at,
         rejection_reason_id,
         pipeline_stages ( type, name, is_terminal )`,
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
  ])

  type StageJoin =
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }[]
    | null
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
      const { data } = await supabase
        .from('candidate_evaluations')
        .select('application_id, score')
        .in('application_id', ids)
      for (const row of (data ?? []) as { application_id: string; score: number | null }[]) {
        if (typeof row.score === 'number') m.set(row.application_id, row.score)
      }
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

  // Wave 2.6 Slice 4 — bucket each app from its pipeline_stages join to
  // the canonical code, then look up the matching application_statuses.id
  // so the CrossVacancyBoard contract (statuses + per-app status_id) stays
  // intact. With status_id gone from the DB, this in-memory id is purely
  // a column-key for the board UI; it never round-trips back to writes.
  const statusIdByCode = new Map<string, string>()
  for (const s of sortedStatuses) statusIdByCode.set(s.code, s.id)
  // Some terminal statuses (rejected / withdrawn) live outside
  // `sortedStatuses` because they're filtered to active. Pull them in too.
  for (const s of appStatuses) statusIdByCode.set(s.code, s.id)

  const applications: CrossVacancyApplication[] = appRows
    .map((a) => {
      const candidate = candidateMap.get(a.candidate_id)
      const vacancy = vacancyMap.get(a.vacancy_id)
      if (!candidate || !vacancy) return null
      // Convert the 0-100 internal scorecard percentage to the 0-10 design
      // pill format (e.g. 84 → 8.4). Null when no evaluation exists yet.
      const rawScore = fitScoreMap.get(a.id)
      const fitScore = typeof rawScore === 'number' ? Math.round(rawScore) / 10 : null

      // Bucket assignment: read the joined pipeline_stages row, bucket-
      // map to the canonical code, then resolve to the canonical
      // application_statuses.id the board expects. Fall back to the
      // first sorted column when the join is empty (defensive — every
      // application should have a pipeline_stage_id post-Migration 049).
      const stageJoin = a.pipeline_stages
      const stageRow = Array.isArray(stageJoin) ? stageJoin[0] : stageJoin
      let resolvedStatusId: string | null = firstStatusId
      if (stageRow) {
        const code = mapPipelineStageToBucket(stageRow)
        const mappedId = statusIdByCode.get(code)
        if (mappedId) resolvedStatusId = mappedId
      }

      return {
        id: a.id,
        candidate_id: a.candidate_id,
        status_id: resolvedStatusId,
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
      const status = sortedStatuses.find((s) => s.id === a.status_id)
      return !!status && !TERMINAL_CODES.has(status.code)
    }).length
    return { id: v.id, title: v.title, activeCount }
  })

  return (
    <div className="flex flex-col gap-4 pb-24">
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

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  current_position: string | null
  current_company: string | null
  source: string | null
}

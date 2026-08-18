import 'server-only'
import { getAuthContext } from '@/lib/actions'
import { buildFunnel, type ApplicationRecord, type StatusChangeRecord, type StatusCode, type FunnelCounts } from './funnel'
import { byVacancy, summarize, type TimeToHireSample, type TimeToHireStats, type PerVacancyBreakdown } from './time-to-hire'
import { buildSourceSummary, type SourceSummaryRow } from './source-summary'
import { periodToRange, type Period } from './period'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'

type PipelineStageJoin = {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
} | {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
}[] | null

function unwrapStage(join: PipelineStageJoin) {
  if (!join) return null
  return Array.isArray(join) ? join[0] ?? null : join
}

function stageBucket(join: PipelineStageJoin): StatusCode {
  const row = unwrapStage(join)
  if (!row) return 'applied'
  return mapPipelineStageToBucket(row) as StatusCode
}

interface AuthCtx {
  supabase: Awaited<ReturnType<typeof getAuthContext>> extends infer T
    ? T extends { supabase: infer S }
      ? S
      : never
    : never
  orgId: string
}

async function authed(): Promise<AuthCtx | null> {
  const ctx = await getAuthContext()
  if (!ctx) return null
  return { supabase: ctx.supabase, orgId: ctx.orgId }
}

export interface PipelineReport {
  funnel: FunnelCounts
}

export async function getPipelineReport(period: Period): Promise<PipelineReport | null> {
  const ctx = await authed()
  if (!ctx) return null

  const { start, end } = periodToRange(period)

  let appsQuery = ctx.supabase
    .from('applications')
    .select('id, applied_at, pipeline_stages ( type, name, is_terminal )')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .lte('applied_at', end.toISOString())
  if (start) appsQuery = appsQuery.gte('applied_at', start.toISOString())

  const { data: appsRaw } = await appsQuery
  const apps: ApplicationRecord[] = (appsRaw ?? []).map((row) => ({
    id: row.id as string,
    current_status: stageBucket(row.pipeline_stages as PipelineStageJoin),
  }))

  if (apps.length === 0) {
    return { funnel: buildFunnel([], []) }
  }

  const appIds = apps.map((a) => a.id)
  const { data: histRaw } = await ctx.supabase
    .from('activity_log')
    .select('entity_id, details')
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', 'application')
    .eq('action', 'status_changed')
    .in('entity_id', appIds)

  const history: StatusChangeRecord[] = []
  for (const row of histRaw ?? []) {
    const details = row.details as { after?: string } | null
    const to = details?.after
    if (!to) continue
    history.push({ application_id: row.entity_id as string, to_status: to as StatusCode })
  }

  return { funnel: buildFunnel(apps, history) }
}

export interface TimeToHireReport {
  stats: TimeToHireStats
  byVacancy: PerVacancyBreakdown[]
  samples: TimeToHireSample[]
}

export async function getTimeToHireReport(period: Period): Promise<TimeToHireReport | null> {
  const ctx = await authed()
  if (!ctx) return null

  const { start, end } = periodToRange(period)

  // Wave 2.6 Slice 2c — the in-DB filter on "current stage = hired"
  // moves to an in-app filter via the bucket-mapper. The row count is
  // bounded by `applied_at` so the in-app pass is cheap.
  let appsQuery = ctx.supabase
    .from('applications')
    .select(
      'id, applied_at, vacancy_id, vacancies(title), pipeline_stages ( type, name, is_terminal )',
    )
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .lte('applied_at', end.toISOString())
  if (start) appsQuery = appsQuery.gte('applied_at', start.toISOString())

  const { data: hiredAppsRaw } = await appsQuery
  const apps = (hiredAppsRaw ?? []).filter(
    (a) => stageBucket(a.pipeline_stages as PipelineStageJoin) === 'hired',
  )
  if (apps.length === 0) {
    return { stats: summarize([]), byVacancy: [], samples: [] }
  }

  const appIds = apps.map((a) => a.id as string)
  const { data: hireEvents } = await ctx.supabase
    .from('activity_log')
    .select('entity_id, created_at, details')
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', 'application')
    .eq('action', 'status_changed')
    .in('entity_id', appIds)
    .order('created_at', { ascending: true })

  const hiredAt = new Map<string, string>()
  for (const row of hireEvents ?? []) {
    const details = row.details as { after?: string } | null
    if (details?.after !== 'hired') continue
    const id = row.entity_id as string
    if (!hiredAt.has(id)) hiredAt.set(id, row.created_at as string)
  }

  const samples: TimeToHireSample[] = []
  for (const app of apps) {
    const id = app.id as string
    const appliedAt = app.applied_at as string | null
    if (!appliedAt) continue
    const hireTime = hiredAt.get(id)
    if (!hireTime) continue
    const days = (new Date(hireTime).getTime() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (!Number.isFinite(days) || days < 0) continue
    const vac = (app as unknown as { vacancies?: { title?: string } | null }).vacancies ?? null
    samples.push({
      applicationId: id,
      vacancyId: (app.vacancy_id as string | null) ?? null,
      vacancyTitle: vac?.title ?? null,
      daysToHire: days,
    })
  }

  return { stats: summarize(samples), byVacancy: byVacancy(samples), samples }
}

export interface SourceReport {
  rows: SourceSummaryRow[]
  totalApplications: number
  totalHires: number
}

export async function getSourceReport(period: Period): Promise<SourceReport | null> {
  const ctx = await authed()
  if (!ctx) return null

  const { start, end } = periodToRange(period)

  let appsQuery = ctx.supabase
    .from('applications')
    .select('id, source_type, applied_at, pipeline_stages ( type, name, is_terminal )')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .lte('applied_at', end.toISOString())
  if (start) appsQuery = appsQuery.gte('applied_at', start.toISOString())

  const { data: appsRaw } = await appsQuery
  const apps = appsRaw ?? []
  if (apps.length === 0) {
    return { rows: [], totalApplications: 0, totalHires: 0 }
  }

  // An application counts as "hired" if its current status is hired OR
  // status_changed history shows after='hired' (covers hired-then-modified
  // edge cases, though no current code path moves out of hired).
  const appIds = apps.map((a) => a.id as string)
  const { data: hireHistory } = await ctx.supabase
    .from('activity_log')
    .select('entity_id, details')
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', 'application')
    .eq('action', 'status_changed')
    .in('entity_id', appIds)

  const everHired = new Set<string>()
  for (const row of hireHistory ?? []) {
    const details = row.details as { after?: string } | null
    if (details?.after === 'hired') everHired.add(row.entity_id as string)
  }

  const rows = apps.map((app) => ({
    sourceType: (app.source_type as string | null) ?? null,
    hired:
      stageBucket(app.pipeline_stages as PipelineStageJoin) === 'hired' ||
      everHired.has(app.id as string),
  }))
  const summary = buildSourceSummary(rows)
  const totalApplications = rows.length
  const totalHires = rows.reduce((acc, r) => acc + (r.hired ? 1 : 0), 0)
  return { rows: summary, totalApplications, totalHires }
}

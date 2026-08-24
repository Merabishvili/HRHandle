import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  VacancyPipelineBoard,
  type PipelineColumn,
} from '@/components/pipeline/vacancy-pipeline-board'
import { getApplicationStatuses } from '@/lib/cache/lookups'
import { shortSourceLabel } from '@/lib/pipeline/source-label'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { localizeRejectionTemplateRow } from '@/lib/email-template-utils'
import type { ApplicationStatus } from '@/lib/types/application'

interface PipelineApplicationRow {
  id: string
  candidate_id: string
  pipeline_stage_id: string | null
  applied_at: string
  last_status_changed_at: string | null
}

interface PipelineCandidateRow {
  id: string
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  source: string | null
  email: string | null
}

/**
 * Per-vacancy pipeline view. Wave 2.6 Slice 2b cut this over to read
 * `pipeline_stages` directly instead of the canonical 7-stage global
 * `application_statuses`. The board now shows each vacancy's own
 * custom stages (cap-10) with their real names, and drops route through
 * the new `updateApplicationPipelineStage` action which preserves the
 * specific stage id (no more bucket collapse on the per-vacancy board).
 *
 * Rejection still hands off via `rejectApplication` (canonical status_id +
 * the dropped pipeline_stage_id override) so the existing audit/email/
 * webhook path keeps working for both legacy and custom rejection stages.
 */
export default async function VacancyPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) redirect('/pipeline')

  const [
    { data: vacancy },
    { data: stagesRaw },
    appStatusesAll,
    { data: applicationsRaw },
    { data: rejectionReasonsRaw },
    { data: rejectionTemplatesRaw },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .single(),

    supabase
      .from('pipeline_stages')
      .select('id, name, type, is_terminal, sort_order')
      .eq('vacancy_id', id)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),

    getApplicationStatuses(),

    supabase
      .from('applications')
      .select('id, candidate_id, pipeline_stage_id, applied_at, last_status_changed_at')
      .eq('vacancy_id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('applied_at', { ascending: true }),

    supabase
      .from('rejection_reasons')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('rejection_templates')
      .select('id, name, subject, body, reason_id')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
  ])

  if (!vacancy) notFound()

  const columns = (stagesRaw ?? []) as PipelineColumn[]
  const applicationsData = (applicationsRaw || []) as PipelineApplicationRow[]

  // Fetch candidates separately to avoid unreliable nested joins
  const candidateIds = [...new Set(applicationsData.map((a) => a.candidate_id))]
  const candidateMap = new Map<string, PipelineCandidateRow>()
  if (candidateIds.length > 0) {
    const { data: candidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, current_position, current_company, source, email')
      .in('id', candidateIds)
      .is('deleted_at', null)
    for (const c of (candidatesRaw || []) as PipelineCandidateRow[]) {
      candidateMap.set(c.id, c)
    }
  }

  // Fit score = average of *submitted* reviewer cards per application, on the
  // 0–10 pill scale (matches the cross-vacancy board). Null when unrated.
  const fitScoreMap = new Map<string, number>()
  if (applicationsData.length > 0) {
    const { data: evalRows } = await supabase
      .from('candidate_evaluations')
      .select('application_id, score')
      .eq('submitted', true)
      .in('application_id', applicationsData.map((a) => a.id))
    const agg = new Map<string, { total: number; count: number }>()
    for (const row of (evalRows ?? []) as { application_id: string; score: number | null }[]) {
      if (typeof row.score === 'number') {
        const cur = agg.get(row.application_id) ?? { total: 0, count: 0 }
        cur.total += row.score
        cur.count += 1
        agg.set(row.application_id, cur)
      }
    }
    for (const [appId, { total, count }] of agg) fitScoreMap.set(appId, Math.round(total / count))
  }

  // The rejection dialog still keys off canonical status_id, so resolve
  // it once and thread it down.
  const rejectedStatusId =
    (appStatusesAll || []).find((s: ApplicationStatus) => s.code === 'rejected')?.id ?? null

  // Map status_id → pipeline_stage_id for any application that's
  // missing one (defensive — Migration 049's backfill should have
  // populated every row, but a partial run shouldn't leave the card
  // invisible). We bucket back through the columns we already loaded.
  const firstColumnId = columns[0]?.id ?? null

  const applications = applicationsData.map((app) => {
    const candidate = candidateMap.get(app.candidate_id)
    const rawScore = fitScoreMap.get(app.id)
    return {
      id: app.id,
      candidate_id: app.candidate_id,
      pipeline_stage_id: app.pipeline_stage_id ?? firstColumnId,
      first_name: candidate?.first_name ?? '?',
      last_name: candidate?.last_name ?? '',
      current_position: candidate?.current_position ?? null,
      current_company: candidate?.current_company ?? null,
      source: shortSourceLabel(candidate?.source ?? null),
      fit_score: typeof rawScore === 'number' ? Math.round(rawScore) / 10 : null,
      email: candidate?.email ?? null,
      last_status_changed_at: app.last_status_changed_at,
      applied_at: app.applied_at,
    }
  })

  // Localize seeded default rejection templates so the reject-dialog preview
  // matches the (already-localized) email that gets sent (#3).
  const orgContentLocale = await fetchOrgContentLocale(supabase, organizationId)
  const rejectionTemplates = (rejectionTemplatesRaw ?? []).map((tpl) =>
    localizeRejectionTemplateRow(tpl, orgContentLocale),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/vacancies/${id}`} aria-label={t('vacPipe.backToVacancy')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('vacPipe.inPipeline', { count: applications.length })}
            </p>
          </div>
        </div>

        <Button variant="outline" asChild>
          <Link href={`/vacancies/${id}`}>{t('vacancies.viewDetails')}</Link>
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{t('candidates.emptyTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('vacPipe.noCandidatesHint')}
          </p>
          <Button className="mt-6" asChild>
            <Link href={`/candidates/new?vacancy=${id}`}>{t('pipeline.addCandidate')}</Link>
          </Button>
        </div>
      ) : (
        <VacancyPipelineBoard
          columns={columns}
          initialApplications={applications}
          rejectionReasons={rejectionReasonsRaw ?? []}
          rejectionTemplates={rejectionTemplates}
          rejectedStatusId={rejectedStatusId}
          vacancyId={id}
          vacancyTitle={vacancy.title}
        />
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { toDisplayFullName } from '@/lib/format-name'
import { getCandidateStatuses } from '@/lib/cache/lookups'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Users, Mail, Phone, MoreHorizontal, Download, Upload } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CandidateStatusActions } from '@/components/candidates/candidate-status-actions'
import { CandidatesToolbar } from '@/components/candidates/candidates-toolbar'
import { FilterPillTabs } from '@/components/shared/filter-pill-tabs'
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types/candidate'
import {
  DEFAULT_CANDIDATE_COLUMNS,
  OPTIONAL_CANDIDATE_COLUMNS,
  type ColumnDef,
} from '@/lib/types/columns'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { getStageStyle, isTerminalStage } from '@/lib/pipeline/stage-style'
import { formatDistanceToNow } from 'date-fns'
import { TablePagination } from '@/components/ui/table-pagination'
import { parsePageSize, type PageSize } from '@/lib/pagination'

type SearchParams = Promise<{
  vacancy?: string
  page?: string
  pageSize?: string
  search?: string
  sort?: string
  status?: string
}>

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  current_company: string | null
  current_position: string | null
  years_of_experience: number | null
  source: string | null
  general_status_id: string | null
  location: string | null
  salary_expectation: string | null
  notice_period: string | null
  languages: string[] | null
  created_at: string
  updated_at: string
}

import type { CandidateStatusOption } from '@/lib/types/database'

interface StageJoinRow {
  name: string
  type: 'standard' | 'review' | 'interview' | 'offer'
  is_terminal: boolean
}

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  applied_at: string
  pipeline_stage_id: string | null
  vacancies: { id: string; title: string }[] | { id: string; title: string } | null
  pipeline_stages: StageJoinRow | StageJoinRow[] | null
}

interface VacancyOption {
  id: string
  title: string
}

function getCandidateFullName(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  // Display casing only — some records are stored ALL-CAPS (CV/import). The
  // stored value is untouched; see lib/format-name.
  return toDisplayFullName(candidate.first_name, candidate.last_name)
}

function getCandidateInitials(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}

function getVacancyTitle(app: ApplicationRow): string | null {
  if (!app.vacancies) return null
  if (Array.isArray(app.vacancies)) return app.vacancies[0]?.title || null
  return (app.vacancies as { title: string }).title || null
}


export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { vacancy: vacancyFilter, page: pageParam, pageSize: pageSizeParam, search = '', sort = 'created_desc', status: statusFilter } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const pageSize: PageSize = parsePageSize(pageSizeParam)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role, column_preferences')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) return null

  const organizationId = profile.organization_id
  const canImport = profile.role === 'owner' || profile.role === 'admin'
  const colPrefs = (profile.column_preferences as Record<string, string[]>) || {}
  const activeColumns: string[] = colPrefs.candidates?.length
    ? colPrefs.candidates
    : DEFAULT_CANDIDATE_COLUMNS

  const candidateStatuses = (await getCandidateStatuses()) as CandidateStatusOption[]
  const statusMap = new Map(candidateStatuses.map((s) => [s.id, s]))

  // Resolve vacancy filter
  let candidateIdsForFilter: string[] | null = null
  let filterVacancyTitle: string | null = null

  if (vacancyFilter) {
    const { data: filteredApplications } = await supabase
      .from('applications')
      .select('candidate_id')
      .eq('organization_id', organizationId)
      .eq('vacancy_id', vacancyFilter)
      .is('deleted_at', null)

    candidateIdsForFilter = [...new Set((filteredApplications || []).map((a) => a.candidate_id))]

    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('title')
      .eq('id', vacancyFilter)
      .single()

    filterVacancyTitle = vacancy?.title || null
  }

  // candidate_statuses is selected so PostgREST can `.order('candidate_statuses(sort_order)')`
  // when sort === 'status'. The actual sort_order value is not used by the row
  // type below; it's only there for the DB-side sort path (F-010).
  const FIELDS = `
    id, first_name, last_name, email, phone, current_company,
    current_position, years_of_experience, source, general_status_id,
    location, salary_expectation, notice_period, languages,
    created_at, updated_at,
    candidate_statuses (sort_order)
  `

  // If a vacancy filter is applied but no candidates have applied to it, skip
  // the candidates query entirely instead of running a doomed query with a
  // fake UUID. (BL-001)
  const forceEmpty =
    !!vacancyFilter && (!candidateIdsForFilter || candidateIdsForFilter.length === 0)

  let candidates: CandidateRow[]
  let totalCount: number | null

  if (forceEmpty) {
    candidates = []
    totalCount = 0
  } else {
    let baseQuery = supabase
      .from('candidates')
      .select(FIELDS, { count: 'exact' })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)

    if (search.trim()) {
      baseQuery = baseQuery.or(
        `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%`
      )
    }

    if (statusFilter) {
      baseQuery = baseQuery.eq('general_status_id', statusFilter)
    }

    if (vacancyFilter && candidateIdsForFilter && candidateIdsForFilter.length > 0) {
      baseQuery = baseQuery.in('id', candidateIdsForFilter)
    }

    // Apply the sort exactly once. Supabase's `.order()` mutates the builder
    // and returns it, so pre-seeding a default order here and then calling
    // `.order()` again in a case would append a SECOND clause — leaving the
    // pre-seeded one as the primary sort (why "Oldest first" never worked).
    let sortedQuery
    switch (sort) {
      case 'created_asc':
        sortedQuery = baseQuery.order('created_at', { ascending: true })
        break
      case 'experience_desc':
        sortedQuery = baseQuery.order('years_of_experience', { ascending: false, nullsFirst: false })
        break
      case 'experience_asc':
        sortedQuery = baseQuery.order('years_of_experience', { ascending: true, nullsFirst: false })
        break
      case 'status':
        // F-010: order by the related candidate_statuses.sort_order so the
        // DB does the paging instead of pulling every row into memory.
        sortedQuery = baseQuery
          .order('candidate_statuses(sort_order)', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
        break
      default:
        sortedQuery = baseQuery.order('created_at', { ascending: false })
    }
    const result = await sortedQuery.range(from, to)
    candidates = (result.data || []) as CandidateRow[]
    totalCount = result.count
  }

  const totalPages = Math.ceil((totalCount ?? 0) / pageSize)

  // Fetch applications for this page of candidates
  const candidateIds = candidates.map((c) => c.id)
  const { data: vacancyOptionsRaw } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .is('deleted_at', null)

  const vacancyOptions = (vacancyOptionsRaw || []) as VacancyOption[]
  const vacancyMap = new Map(vacancyOptions.map((v) => [v.id, v]))

  let applications: ApplicationRow[] = []
  if (candidateIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select(
        'id, candidate_id, vacancy_id, applied_at, pipeline_stage_id, vacancies(id, title), pipeline_stages(name, type, is_terminal)',
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('candidate_id', candidateIds)

    applications = (applicationsRaw || []) as ApplicationRow[]
  }

  const applicationsByCandidate = new Map<string, ApplicationRow[]>()
  for (const app of applications) {
    const existing = applicationsByCandidate.get(app.candidate_id) || []
    existing.push(app)
    applicationsByCandidate.set(app.candidate_id, existing)
  }

  // Stage + Fit-score columns (optional): derive from each candidate's *active*
  // (non-terminal) application, falling back to their first application. Stage
  // is bucket-mapped so the badge uses the same palette as the Pipeline; fit
  // score is the 0–100 evaluation score on that application, shown as a %.
  const fitScoreByApplication = new Map<string, number>()
  const applicationIds = applications.map((a) => a.id)
  if (applicationIds.length > 0) {
    // Fit score = average of *submitted* reviewer cards per application.
    const { data: evalRows } = await supabase
      .from('candidate_evaluations')
      .select('application_id, score')
      .eq('submitted', true)
      .in('application_id', applicationIds)
    const agg = new Map<string, { total: number; count: number }>()
    for (const row of (evalRows ?? []) as { application_id: string; score: number | null }[]) {
      if (typeof row.score === 'number') {
        const cur = agg.get(row.application_id) ?? { total: 0, count: 0 }
        cur.total += row.score
        cur.count += 1
        agg.set(row.application_id, cur)
      }
    }
    for (const [appId, { total, count }] of agg) {
      fitScoreByApplication.set(appId, Math.round(total / count))
    }
  }

  const stageByCandidate = new Map<string, { code: string; name: string }>()
  const fitScoreByCandidate = new Map<string, number>()
  for (const [candId, apps] of applicationsByCandidate) {
    const stageOf = (a: ApplicationRow): StageJoinRow | null => {
      const j = a.pipeline_stages
      return Array.isArray(j) ? (j[0] ?? null) : j
    }
    // Prefer the first application still in a non-terminal stage.
    const active =
      apps.find((a) => {
        const s = stageOf(a)
        return s ? !isTerminalStage(mapPipelineStageToBucket(s)) : false
      }) ?? apps[0]
    if (!active) continue
    const stageRow = stageOf(active)
    if (stageRow) {
      stageByCandidate.set(candId, {
        code: mapPipelineStageToBucket(stageRow),
        name: stageRow.name,
      })
    }
    const fit = fitScoreByApplication.get(active.id)
    if (typeof fit === 'number') fitScoreByCandidate.set(candId, fit)
  }

  // Org custom fields → addable columns (key `cf_<fieldId>`). Values are fetched
  // in one batch for the visible candidates and formatted per field type.
  const customFieldGroups = await getCustomFieldSchema('candidate')
  const customFields = customFieldGroups.flatMap((g) => g.fields)
  const customFieldColumns: ColumnDef[] = customFields.map((f) => ({
    key: `cf_${f.id}`,
    label: f.name,
  }))
  const customFieldTypeById = new Map(customFields.map((f) => [f.id, f.field_type]))
  // valueMap: `${candidateId}:${fieldId}` -> display string
  const customFieldValueMap = new Map<string, string>()
  if (candidateIds.length > 0 && customFields.length > 0) {
    const { data: cfValues } = await supabase
      .from('custom_field_values')
      .select('field_id, entity_id, value_text, value_number, value_boolean, value_option')
      .eq('organization_id', organizationId)
      .in('entity_id', candidateIds)
      .in('field_id', customFields.map((f) => f.id))
    for (const v of (cfValues ?? []) as {
      field_id: string
      entity_id: string
      value_text: string | null
      value_number: number | null
      value_boolean: boolean | null
      value_option: string | null
    }[]) {
      const type = customFieldTypeById.get(v.field_id)
      let display: string | null = null
      if (type === 'number') display = v.value_number != null ? String(v.value_number) : null
      else if (type === 'checkbox') display = v.value_boolean == null ? null : v.value_boolean ? 'Yes' : 'No'
      else if (type === 'dropdown') display = v.value_option
      else display = v.value_text // text / long_text / date
      if (display != null && display !== '') {
        customFieldValueMap.set(`${v.entity_id}:${v.field_id}`, display)
      }
    }
  }

  // Build column label map for header (built-in + custom fields)
  const optColMap = new Map(
    [...OPTIONAL_CANDIDATE_COLUMNS, ...customFieldColumns].map((c) => [c.key, c.label]),
  )

  // Preserved URL params for the paginator's links. Plain object — no
  // function prop, so it serialises across the server→client boundary
  // (React 19 RSC forbids functions defined in server components from
  // being passed into client components).
  const paginationPreserved: Record<string, string> = {}
  if (vacancyFilter) paginationPreserved.vacancy = vacancyFilter
  if (search) paginationPreserved.search = search
  if (sort !== 'created_desc') paginationPreserved.sort = sort
  if (statusFilter) paginationPreserved.status = statusFilter

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-muted-foreground">
            {filterVacancyTitle
              ? `Showing candidates for: ${filterVacancyTitle}`
              : 'Track and manage your candidate database.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {vacancyFilter && (
            <Button variant="outline" asChild>
              <Link href="/candidates">Clear filter</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href="/api/export/candidates" download>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
          {canImport && (
            <Button variant="outline" asChild>
              <Link href="/candidates/import">
                <Upload className="mr-2 h-4 w-4" />
                Bulk import
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={vacancyFilter ? `/candidates/new?vacancy=${vacancyFilter}` : '/candidates/new'}>
              <Plus className="mr-2 h-4 w-4" />
              Add candidate
            </Link>
          </Button>
        </div>
      </div>

      <CandidatesToolbar
        initialSearch={search}
        initialSort={sort}
        initialStatus={statusFilter || ''}
        selectedColumns={activeColumns}
        extraColumns={customFieldColumns}
      />

      <div className="flex items-center justify-between gap-4">
        <FilterPillTabs
          tabs={[
            { value: 'all', label: 'All' },
            ...candidateStatuses.map((s) => ({ value: s.id, label: s.name })),
          ]}
          paramKey="status"
          activeValue={statusFilter || ''}
        />
        <p className="text-sm text-muted-foreground shrink-0">
          {totalCount ?? 0} {(totalCount ?? 0) === 1 ? 'candidate' : 'candidates'}
          {search && ` · "${search}"`}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {candidates.length > 0 ? (
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linked vacancy</TableHead>
                    {activeColumns.map((col) => (
                      <TableHead key={col}>{optColMap.get(col) ?? col}</TableHead>
                    ))}
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {candidates.map((candidate) => {
                    const fullName = getCandidateFullName(candidate)
                    const initials = getCandidateInitials(candidate)
                    const candidateApplications = applicationsByCandidate.get(candidate.id) || []

                    const firstApp = candidateApplications[0]
                    const firstVacancyTitle = firstApp
                      ? (getVacancyTitle(firstApp) ?? vacancyMap.get(firstApp.vacancy_id)?.title ?? null)
                      : null
                    const extraCount = candidateApplications.length > 1 ? candidateApplications.length - 1 : 0

                    const status = candidate.general_status_id
                      ? statusMap.get(candidate.general_status_id)
                      : null

                    return (
                      <TableRow key={candidate.id}>
                        {/* Fixed: Candidate name */}
                        <TableCell>
                          <Link
                            href={`/candidates/${candidate.id}`}
                            className="flex items-center gap-3 hover:underline"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <span className="text-sm font-medium text-primary">{initials}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{fullName}</p>
                              {candidate.source && (
                                <p className="text-xs text-muted-foreground">via {candidate.source}</p>
                              )}
                            </div>
                          </Link>
                        </TableCell>

                        {/* Fixed: Status */}
                        <TableCell>
                          {status ? (
                            <Badge
                              variant="secondary"
                              className={CANDIDATE_GENERAL_STATUS_COLORS[status.code]}
                            >
                              {status.name}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not set</span>
                          )}
                        </TableCell>

                        {/* Fixed: Linked Vacancy */}
                        <TableCell>
                          {candidateApplications.length > 0 ? (
                            <div className="space-y-0.5">
                              <p className="text-sm text-foreground">{firstVacancyTitle || 'Unknown vacancy'}</p>
                              {extraCount > 0 && (
                                <p className="text-xs text-muted-foreground">+{extraCount} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not linked</span>
                          )}
                        </TableCell>

                        {/* Optional columns */}
                        {activeColumns.map((col) => {
                          switch (col) {
                            case 'current_position':
                              return (
                                <TableCell key={col}>
                                  <div>
                                    <p className="text-sm">{candidate.current_position || '—'}</p>
                                    {candidate.current_company && (
                                      <p className="text-xs text-muted-foreground">{candidate.current_company}</p>
                                    )}
                                  </div>
                                </TableCell>
                              )
                            case 'current_company':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.current_company || '—'}
                                </TableCell>
                              )
                            case 'created_at':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(candidate.created_at), { addSuffix: true })}
                                </TableCell>
                              )
                            case 'email':
                              return (
                                <TableCell key={col}>
                                  {candidate.email ? (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      {candidate.email}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              )
                            case 'phone':
                              return (
                                <TableCell key={col}>
                                  {candidate.phone ? (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      {candidate.phone}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              )
                            case 'years_of_experience':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.years_of_experience != null
                                    ? `${candidate.years_of_experience} yr${candidate.years_of_experience === 1 ? '' : 's'}`
                                    : '—'}
                                </TableCell>
                              )
                            case 'source':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.source || '—'}
                                </TableCell>
                              )
                            case 'stage': {
                              const stage = stageByCandidate.get(candidate.id)
                              if (!stage) {
                                return <TableCell key={col} className="text-sm text-muted-foreground">—</TableCell>
                              }
                              const style = getStageStyle(stage.code)
                              return (
                                <TableCell key={col}>
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                    style={{ background: style.pillBg, color: style.pillText }}
                                  >
                                    {stage.name}
                                  </span>
                                </TableCell>
                              )
                            }
                            case 'fit_score': {
                              const fit = fitScoreByCandidate.get(candidate.id)
                              return (
                                <TableCell key={col} className="text-sm tabular-nums text-muted-foreground">
                                  {typeof fit === 'number' ? `${fit}%` : '—'}
                                </TableCell>
                              )
                            }
                            case 'location':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.location || '—'}
                                </TableCell>
                              )
                            case 'salary_expectation':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.salary_expectation || '—'}
                                </TableCell>
                              )
                            case 'notice_period':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.notice_period || '—'}
                                </TableCell>
                              )
                            case 'languages':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {candidate.languages && candidate.languages.length > 0
                                    ? candidate.languages.join(', ')
                                    : '—'}
                                </TableCell>
                              )
                            default:
                              // Custom-field columns (key `cf_<fieldId>`).
                              if (col.startsWith('cf_')) {
                                const fieldId = col.slice(3)
                                return (
                                  <TableCell key={col} className="text-sm text-muted-foreground">
                                    {customFieldValueMap.get(`${candidate.id}:${fieldId}`) || '—'}
                                  </TableCell>
                                )
                              }
                              return <TableCell key={col}>—</TableCell>
                          }
                        })}

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Candidate actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/candidates/${candidate.id}`}>View details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/candidates/${candidate.id}/edit`}>Edit candidate</Link>
                              </DropdownMenuItem>
                              <CandidateStatusActions
                                candidateId={candidate.id}
                                candidateName={`${candidate.first_name} ${candidate.last_name}`.trim() || 'this candidate'}
                              />
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount ?? 0}
                pageSize={pageSize}
                basePath="/candidates"
                preservedParams={paginationPreserved}
                ariaLabel="Candidate list pagination"
              />
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {search ? `No candidates matching "${search}"` : 'No candidates yet'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? 'Try a different search term.'
                  : 'Start adding candidates to track your hiring pipeline.'}
              </p>
              {!search && (
                <Button className="mt-4" asChild>
                  <Link href="/candidates/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add candidate
                  </Link>
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

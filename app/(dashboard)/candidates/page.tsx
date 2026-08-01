import { createClient } from '@/lib/supabase/server'
import { getCandidateStatuses } from '@/lib/cache/lookups'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Users, Download, Upload } from 'lucide-react'
import { CandidatesToolbar } from '@/components/candidates/candidates-toolbar'
import { CandidateTableRow } from '@/components/candidates/candidate-table-row'
import { FilterPillTabs } from '@/components/shared/filter-pill-tabs'
import {
  DEFAULT_CANDIDATE_COLUMNS,
  OPTIONAL_CANDIDATE_COLUMNS,
  COLUMN_I18N_KEY,
  type ColumnDef,
} from '@/lib/types/columns'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'
import { TablePagination } from '@/components/ui/table-pagination'
import { parsePageSize, type PageSize } from '@/lib/pagination'
import {
  aggregateFitScores,
  buildCustomFieldValueMap,
  deriveStageAndFit,
  groupApplicationsByCandidate,
  type ApplicationRow,
  type CandidateRow,
  type EvaluationRow,
  type CustomFieldValueRow,
  type VacancyOption,
} from '@/lib/candidates/list-derivation'
import type { CandidateStatusOption } from '@/lib/types/database'

type SearchParams = Promise<{
  vacancy?: string
  page?: string
  pageSize?: string
  search?: string
  sort?: string
  status?: string
}>

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

  const t = await getTranslations()
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

  const applicationsByCandidate = groupApplicationsByCandidate(applications)

  // Stage + Fit-score columns (optional): fit = average of *submitted* reviewer
  // cards per application; stage/fit are then attributed to each candidate's
  // active (non-terminal, else first) application. See lib/candidates/list-derivation.
  const applicationIds = applications.map((a) => a.id)
  let evalRows: EvaluationRow[] = []
  if (applicationIds.length > 0) {
    const { data } = await supabase
      .from('candidate_evaluations')
      .select('application_id, score')
      .eq('submitted', true)
      .in('application_id', applicationIds)
    evalRows = (data ?? []) as EvaluationRow[]
  }
  const fitScoreByApplication = aggregateFitScores(evalRows)
  const { stageByCandidate, fitScoreByCandidate } = deriveStageAndFit(
    applicationsByCandidate,
    fitScoreByApplication,
  )

  // Org custom fields → addable columns (key `cf_<fieldId>`). Values are fetched
  // in one batch for the visible candidates and formatted per field type.
  const customFieldGroups = await getCustomFieldSchema('candidate')
  const customFields = customFieldGroups.flatMap((g) => g.fields)
  const customFieldColumns: ColumnDef[] = customFields.map((f) => ({
    key: `cf_${f.id}`,
    label: f.name,
  }))
  const customFieldTypeById = new Map(customFields.map((f) => [f.id, f.field_type]))
  let customFieldValueMap = new Map<string, string>()
  if (candidateIds.length > 0 && customFields.length > 0) {
    const { data: cfValues } = await supabase
      .from('custom_field_values')
      .select('field_id, entity_id, value_text, value_number, value_boolean, value_option')
      .eq('organization_id', organizationId)
      .in('entity_id', candidateIds)
      .in('field_id', customFields.map((f) => f.id))
    customFieldValueMap = buildCustomFieldValueMap(
      (cfValues ?? []) as CustomFieldValueRow[],
      customFieldTypeById,
    )
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
          <h1 className="text-2xl font-bold text-foreground">{t('candidates.title')}</h1>
          <p className="text-muted-foreground">
            {filterVacancyTitle
              ? t('candidates.showingFor', { vacancy: filterVacancyTitle })
              : t('candidates.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {vacancyFilter && (
            <Button variant="outline" asChild>
              <Link href="/candidates">{t('candidates.clearFilter')}</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href="/api/export/candidates" download>
              <Download className="mr-2 h-4 w-4" />
              {t('candidates.exportCsv')}
            </a>
          </Button>
          {canImport && (
            <Button variant="outline" asChild>
              <Link href="/candidates/import">
                <Upload className="mr-2 h-4 w-4" />
                {t('candidates.bulkImport')}
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={vacancyFilter ? `/candidates/new?vacancy=${vacancyFilter}` : '/candidates/new'}>
              <Plus className="mr-2 h-4 w-4" />
              {t('candidates.addCandidate')}
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
            { value: 'all', label: t('candidates.allTab') },
            ...candidateStatuses.map((s) => ({ value: s.id, label: s.name })),
          ]}
          paramKey="status"
          activeValue={statusFilter || ''}
        />
        <p className="text-sm text-muted-foreground shrink-0">
          {t('candidates.count', { count: totalCount ?? 0 })}
          {search && ` · "${search}"`}
          {totalPages > 1 && ` · ${t('candidates.pageOf', { page, total: totalPages })}`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {candidates.length > 0 ? (
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('candidates.colCandidate')}</TableHead>
                    <TableHead>{t('candidates.colStatus')}</TableHead>
                    <TableHead>{t('candidates.colLinkedVacancy')}</TableHead>
                    {activeColumns.map((col) => (
                      <TableHead key={col}>
                        {COLUMN_I18N_KEY[col] ? t(COLUMN_I18N_KEY[col]) : (optColMap.get(col) ?? col)}
                      </TableHead>
                    ))}
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {candidates.map((candidate) => (
                    <CandidateTableRow
                      key={candidate.id}
                      candidate={candidate}
                      applications={applicationsByCandidate.get(candidate.id) || []}
                      vacancyMap={vacancyMap}
                      status={candidate.general_status_id ? statusMap.get(candidate.general_status_id) ?? null : null}
                      activeColumns={activeColumns}
                      stage={stageByCandidate.get(candidate.id)}
                      fit={fitScoreByCandidate.get(candidate.id)}
                      customFieldValueMap={customFieldValueMap}
                    />
                  ))}
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
                {search ? t('candidates.emptySearchTitle', { search }) : t('candidates.emptyTitle')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search ? t('candidates.emptySearchBody') : t('candidates.emptyBody')}
              </p>
              {!search && (
                <Button className="mt-4" asChild>
                  <Link href="/candidates/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('candidates.addCandidate')}
                  </Link>
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { getVacancyStatuses } from '@/lib/cache/lookups'
import { getTranslations } from 'next-intl/server'
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
import { Plus, Briefcase, MapPin, Users, MoreHorizontal, Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VacancyActions } from '@/components/vacancies/vacancy-actions'
import { VacanciesToolbar } from '@/components/vacancies/vacancies-toolbar'
import { FilterPillTabs } from '@/components/shared/filter-pill-tabs'
import { VACANCY_STATUS_COLORS } from '@/lib/types/vacancy'
import {
  DEFAULT_VACANCY_COLUMNS,
  OPTIONAL_VACANCY_COLUMNS,
  COLUMN_I18N_KEY,
  type ColumnDef,
} from '@/lib/types/columns'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'
import { TablePagination } from '@/components/ui/table-pagination'
import { parsePageSize, type PageSize } from '@/lib/pagination'
import { vacancyRecencyLabel } from '@/lib/vacancy-age'
import { sectorLabel } from '@/lib/vacancies/sector-i18n'

type SearchParams = Promise<{
  page?: string
  pageSize?: string
  search?: string
  sort?: string
  status?: string
}>

interface VacancyStatusOption {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  is_active: boolean
  sort_order: number
}

interface VacancyRow {
  id: string
  organization_id: string
  title: string
  sector_id: string | null
  status_id: string | null
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  work_mode: 'remote' | 'hybrid' | 'onsite' | null
  hiring_manager_name: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  openings_count: number
  start_date: string
  end_date: string | null
  description: string
  requirements: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  vacancy_statuses:
    | { id: string; name: string; code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived' }[]
    | null
  sectors: { name: string } | { name: string }[] | null
}

function employmentTypeKey(value: VacancyRow['employment_type']): string {
  switch (value) {
    case 'full_time': return 'enum.employment.fullTime'
    case 'part_time': return 'enum.employment.partTime'
    case 'contract': return 'enum.employment.contract'
    case 'internship': return 'enum.employment.internship'
    default: return 'common.notSpecified'
  }
}

function workModeKey(value: VacancyRow['work_mode']): string | null {
  switch (value) {
    case 'remote': return 'enum.workMode.remote'
    case 'hybrid': return 'enum.workMode.hybrid'
    case 'onsite': return 'enum.workMode.onsite'
    default: return null
  }
}

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { page: pageParam, pageSize: pageSizeParam, search = '', sort = 'created_desc', status: statusFilter } = await searchParams
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, column_preferences')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) return null

  const { data: orgData } = await supabase
    .from('organizations')
    .select('public_page_slug')
    .eq('id', organizationId)
    .single()

  const publicPageSlug = orgData?.public_page_slug as string | null

  const colPrefs = (profile?.column_preferences as Record<string, string[]>) || {}
  const activeColumns: string[] = colPrefs.vacancies?.length
    ? colPrefs.vacancies
    : DEFAULT_VACANCY_COLUMNS

  const statusOptions = (await getVacancyStatuses()) as VacancyStatusOption[]
  const statusMap = new Map(statusOptions.map((s) => [s.id, s]))

  const FIELDS = `
    id, organization_id, title, sector_id, status_id, department, location,
    employment_type, work_mode, hiring_manager_name, salary_min, salary_max, salary_currency,
    openings_count, start_date, end_date, description, requirements, created_by,
    created_at, updated_at, archived_at,
    vacancy_statuses(id, name, code),
    sectors(name)
  `

  let baseQuery = supabase
    .from('vacancies')
    .select(FIELDS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .is('deleted_at', null)

  if (search.trim()) {
    baseQuery = baseQuery.ilike('title', `%${search.trim()}%`)
  }

  if (statusFilter) {
    baseQuery = baseQuery.eq('status_id', statusFilter)
  }

  let vacancies: VacancyRow[]
  let totalCount: number | null

  if (sort === 'status') {
    const { data: allRaw, count } = await baseQuery.order('created_at', { ascending: false })
    totalCount = count
    const statusSortOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]))
    const sorted = ((allRaw || []) as VacancyRow[]).sort((a, b) => {
      const aOrder = a.status_id ? (statusSortOrder.get(a.status_id) ?? 999) : 999
      const bOrder = b.status_id ? (statusSortOrder.get(b.status_id) ?? 999) : 999
      return aOrder - bOrder
    })
    vacancies = sorted.slice(from, to + 1)
  } else {
    // Apply the sort exactly once — `.order()` mutates + returns the builder,
    // so pre-seeding a default and then re-ordering in a case would append a
    // second clause and keep the default as primary (sort appeared broken).
    let sortedQuery
    switch (sort) {
      case 'created_asc':
        sortedQuery = baseQuery.order('created_at', { ascending: true })
        break
      case 'end_asc':
        sortedQuery = baseQuery.order('end_date', { ascending: true, nullsFirst: false })
        break
      case 'end_desc':
        sortedQuery = baseQuery.order('end_date', { ascending: false, nullsFirst: false })
        break
      default:
        sortedQuery = baseQuery.order('created_at', { ascending: false })
    }
    const result = await sortedQuery.range(from, to)
    vacancies = (result.data || []) as VacancyRow[]
    totalCount = result.count
  }

  const totalPages = Math.ceil((totalCount ?? 0) / pageSize)

  const vacancyIds = vacancies.map((v) => v.id)

  const applicationCounts = new Map<string, number>()
  // Health column: a vacancy is "good" if any of its applications moved stage in
  // the last 7 days, "stale" if it's been open >30 days with no movement, else
  // "watch" — same heuristic as the vacancy detail overview.
  const recentMovementByVacancy = new Set<string>()
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const nowMs = Date.now()
  if (vacancyIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select('vacancy_id, last_status_changed_at')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('vacancy_id', vacancyIds)

    for (const app of (applicationsRaw || []) as {
      vacancy_id: string
      last_status_changed_at: string | null
    }[]) {
      applicationCounts.set(app.vacancy_id, (applicationCounts.get(app.vacancy_id) || 0) + 1)
      if (
        app.last_status_changed_at &&
        nowMs - Date.parse(app.last_status_changed_at) < SEVEN_DAYS_MS
      ) {
        recentMovementByVacancy.add(app.vacancy_id)
      }
    }
  }

  // Org custom fields → addable columns (key `cf_<fieldId>`), values batch-fetched
  // for the visible vacancies and formatted per field type.
  const customFieldGroups = await getCustomFieldSchema('vacancy')
  const customFields = customFieldGroups.flatMap((g) => g.fields)
  const customFieldColumns: ColumnDef[] = customFields.map((f) => ({
    key: `cf_${f.id}`,
    label: f.name,
  }))
  const customFieldTypeById = new Map(customFields.map((f) => [f.id, f.field_type]))
  const customFieldValueMap = new Map<string, string>()
  if (vacancyIds.length > 0 && customFields.length > 0) {
    const { data: cfValues } = await supabase
      .from('custom_field_values')
      .select('field_id, entity_id, value_text, value_number, value_boolean, value_option')
      .eq('organization_id', organizationId)
      .in('entity_id', vacancyIds)
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
      else if (type === 'checkbox') display = v.value_boolean == null ? null : v.value_boolean ? t('common.yes') : t('common.no')
      else if (type === 'dropdown') display = v.value_option
      else display = v.value_text
      if (display != null && display !== '') {
        customFieldValueMap.set(`${v.entity_id}:${v.field_id}`, display)
      }
    }
  }

  const optColMap = new Map(
    [...OPTIONAL_VACANCY_COLUMNS, ...customFieldColumns].map((c) => [c.key, c.label]),
  )

  // Preserved URL params for the paginator's links. Plain object (not a
  // function prop) so it serialises across the server→client boundary.
  const paginationPreserved: Record<string, string> = {}
  if (search) paginationPreserved.search = search
  if (sort !== 'created_desc') paginationPreserved.sort = sort
  if (statusFilter) paginationPreserved.status = statusFilter

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('vacancies.title')}</h1>
          <p className="text-muted-foreground">{t('vacancies.subtitle')}</p>
        </div>

        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('wizard.createVacancy')}
          </Link>
        </Button>
      </div>

      {publicPageSlug && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{t('vacancies.publicJobsPage')}</span>
          <Link
            href={`/jobs/${publicPageSlug}`}
            target="_blank"
            className="font-medium text-primary hover:underline truncate"
          >
            {process.env.NEXT_PUBLIC_APP_URL ?? ''}/jobs/{publicPageSlug}
          </Link>
        </div>
      )}

      <VacanciesToolbar
        initialSearch={search}
        initialSort={sort}
        selectedColumns={activeColumns}
        extraColumns={customFieldColumns}
      />

      <div className="flex items-center justify-between gap-4">
        <FilterPillTabs
          tabs={[
            { value: 'all', label: t('candidates.allTab') },
            ...statusOptions.map((s) => ({
              value: s.id,
              label: t.has(`vacStatus.${s.code}`) ? t(`vacStatus.${s.code}`) : s.name,
            })),
          ]}
          paramKey="status"
          activeValue={statusFilter || ''}
        />
        <p className="text-sm text-muted-foreground shrink-0">
          {t('vacancies.countLabel', { count: totalCount ?? 0 })}
          {search && t('vacancies.searchSuffix', { search })}
          {totalPages > 1 && t('vacancies.pageSuffix', { page, total: totalPages })}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {vacancies.length > 0 ? (
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('vacancies.colVacancy')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('vacancies.colCandidates')}</TableHead>
                    {activeColumns.map((col) => (
                      <TableHead key={col}>
                        {COLUMN_I18N_KEY[col] ? t(COLUMN_I18N_KEY[col]) : (optColMap.get(col) ?? col)}
                      </TableHead>
                    ))}
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {vacancies.map((vacancy) => {
                    const relatedStatus = vacancy.vacancy_statuses?.[0] || null
                    const status = relatedStatus || statusMap.get(vacancy.status_id ?? '') || null
                    const count = applicationCounts.get(vacancy.id) || 0

                    return (
                      <TableRow key={vacancy.id}>
                        {/* Fixed: Position */}
                        <TableCell>
                          <Link
                            href={`/vacancies/${vacancy.id}`}
                            className="flex items-center gap-3 hover:underline"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{vacancy.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t(employmentTypeKey(vacancy.employment_type))} ·{' '}
                                {(() => {
                                  const r = vacancyRecencyLabel(vacancy.created_at, status?.code === 'draft')
                                  return t(r.key, { days: r.days })
                                })()}
                              </p>
                            </div>
                          </Link>
                        </TableCell>

                        {/* Fixed: Status */}
                        <TableCell>
                          {status ? (
                            <Badge variant="secondary" className={VACANCY_STATUS_COLORS[status.code]}>
                              {t.has(`vacStatus.${status.code}`) ? t(`vacStatus.${status.code}`) : status.name}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{t('common.unknown')}</Badge>
                          )}
                        </TableCell>

                        {/* Fixed: Candidates count */}
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {count}
                          </div>
                        </TableCell>

                        {/* Optional columns */}
                        {activeColumns.map((col) => {
                          switch (col) {
                            case 'department':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {vacancy.department || '—'}
                                </TableCell>
                              )
                            case 'location':
                              return (
                                <TableCell key={col}>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {vacancy.location || t('enum.workMode.remote')}
                                  </div>
                                </TableCell>
                              )
                            case 'end_date':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground whitespace-nowrap">
                                  {vacancy.end_date
                                    ? new Date(vacancy.end_date).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                              )
                            case 'employment_type':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {t(employmentTypeKey(vacancy.employment_type))}
                                </TableCell>
                              )
                            case 'work_mode': {
                              const wmKey = workModeKey(vacancy.work_mode)
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {wmKey ? t(wmKey) : '—'}
                                </TableCell>
                              )
                            }
                            case 'start_date':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground whitespace-nowrap">
                                  {new Date(vacancy.start_date).toLocaleDateString()}
                                </TableCell>
                              )
                            case 'openings_count':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {vacancy.openings_count}
                                </TableCell>
                              )
                            case 'hiring_manager_name':
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {vacancy.hiring_manager_name || '—'}
                                </TableCell>
                              )
                            case 'sector': {
                              const sector = Array.isArray(vacancy.sectors)
                                ? vacancy.sectors[0]
                                : vacancy.sectors
                              return (
                                <TableCell key={col} className="text-sm text-muted-foreground">
                                  {sectorLabel(t, sector?.name) || '—'}
                                </TableCell>
                              )
                            }
                            case 'salary': {
                              const { salary_min: lo, salary_max: hi, salary_currency: cur } = vacancy
                              const fmt = (n: number) => n.toLocaleString()
                              const label =
                                lo != null && hi != null
                                  ? `${fmt(lo)}–${fmt(hi)} ${cur}`
                                  : lo != null
                                    ? t('vacancies.salaryFrom', { amount: `${fmt(lo)} ${cur}` })
                                    : hi != null
                                      ? t('wizard.upTo', { amount: `${fmt(hi)} ${cur}` })
                                      : '—'
                              return (
                                <TableCell key={col} className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
                                  {label}
                                </TableCell>
                              )
                            }
                            case 'health': {
                              const openDays = Math.max(
                                0,
                                Math.floor((nowMs - Date.parse(vacancy.created_at)) / (1000 * 60 * 60 * 24)),
                              )
                              const health: 'good' | 'watch' | 'stale' = recentMovementByVacancy.has(vacancy.id)
                                ? 'good'
                                : openDays > 30
                                  ? 'stale'
                                  : 'watch'
                              const meta = {
                                good: { label: t('vacOverview.healthGood'), cls: 'bg-emerald-100 text-emerald-800' },
                                watch: { label: t('vacOverview.healthWatch'), cls: 'bg-amber-100 text-amber-800' },
                                stale: { label: t('vacOverview.healthStale'), cls: 'bg-red-100 text-red-800' },
                              }[health]
                              return (
                                <TableCell key={col}>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                                    {meta.label}
                                  </span>
                                </TableCell>
                              )
                            }
                            default:
                              // Custom-field columns (key `cf_<fieldId>`).
                              if (col.startsWith('cf_')) {
                                const fieldId = col.slice(3)
                                return (
                                  <TableCell key={col} className="text-sm text-muted-foreground">
                                    {customFieldValueMap.get(`${vacancy.id}:${fieldId}`) || '—'}
                                  </TableCell>
                                )
                              }
                              return <TableCell key={col}>—</TableCell>
                          }
                        })}

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t('vacancies.rowActions')}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/vacancies/${vacancy.id}`}>{t('vacancies.viewDetails')}</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/vacancies/${vacancy.id}/edit`}>{t('vacancies.editVacancy')}</Link>
                              </DropdownMenuItem>
                              <VacancyActions
                                vacancyId={vacancy.id}
                                currentStatusId={vacancy.status_id}
                                statusOptions={statusOptions}
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
                basePath="/vacancies"
                preservedParams={paginationPreserved}
                ariaLabel={t('vacancies.paginationAria')}
              />
            </div>
          ) : (
            <div className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {search ? t('vacancies.emptySearchTitle', { search }) : t('vacancies.emptyTitle')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? t('candidates.emptySearchBody')
                  : t('vacancies.emptyBody')}
              </p>
              {!search && (
                <Button className="mt-4" asChild>
                  <Link href="/vacancies/new">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('wizard.createVacancy')}
                  </Link>
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

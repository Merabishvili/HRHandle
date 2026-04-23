import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Briefcase, MapPin, Users, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VacancyActions } from '@/components/vacancies/vacancy-actions'
import { VacanciesToolbar } from '@/components/vacancies/vacancies-toolbar'
import { VACANCY_STATUS_COLORS } from '@/lib/types/vacancy'
import {
  DEFAULT_VACANCY_COLUMNS,
  OPTIONAL_VACANCY_COLUMNS,
} from '@/lib/types/columns'

type SearchParams = Promise<{
  page?: string
  search?: string
  sort?: string
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
}

function formatEmploymentType(value: VacancyRow['employment_type']): string {
  switch (value) {
    case 'full_time': return 'Full-time'
    case 'part_time': return 'Part-time'
    case 'contract': return 'Contract'
    case 'internship': return 'Internship'
    default: return 'Not specified'
  }
}

const PAGE_SIZE = 20

export default async function VacanciesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { page: pageParam, search = '', sort = 'created_desc' } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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

  const colPrefs = (profile?.column_preferences as Record<string, string[]>) || {}
  const activeColumns: string[] = colPrefs.vacancies?.length
    ? colPrefs.vacancies
    : DEFAULT_VACANCY_COLUMNS

  const { data: statusOptionsRaw } = await supabase
    .from('vacancy_statuses')
    .select('id, name, code, is_active, sort_order')
    .order('sort_order', { ascending: true })

  const statusOptions = (statusOptionsRaw || []) as VacancyStatusOption[]
  const statusMap = new Map(statusOptions.map((s) => [s.id, s]))

  const FIELDS = `
    id, organization_id, title, sector_id, status_id, department, location,
    employment_type, hiring_manager_name, salary_min, salary_max, salary_currency,
    openings_count, start_date, end_date, description, requirements, created_by,
    created_at, updated_at, archived_at,
    vacancy_statuses(id, name, code)
  `

  let baseQuery = supabase
    .from('vacancies')
    .select(FIELDS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  if (search.trim()) {
    baseQuery = baseQuery.ilike('title', `%${search.trim()}%`)
  }

  let vacancies: VacancyRow[]
  let totalCount: number | null

  if (sort === 'status') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allRaw, count } = await (baseQuery as any).order('created_at', { ascending: false })
    totalCount = count
    const statusSortOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]))
    const sorted = ((allRaw || []) as VacancyRow[]).sort((a, b) => {
      const aOrder = a.status_id ? (statusSortOrder.get(a.status_id) ?? 999) : 999
      const bOrder = b.status_id ? (statusSortOrder.get(b.status_id) ?? 999) : 999
      return aOrder - bOrder
    })
    vacancies = sorted.slice(from, to + 1)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortedQuery: any = baseQuery
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

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  const vacancyIds = vacancies.map((v) => v.id)

  let applicationCounts = new Map<string, number>()
  if (vacancyIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select('vacancy_id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('vacancy_id', vacancyIds)

    for (const app of applicationsRaw || []) {
      applicationCounts.set(app.vacancy_id, (applicationCounts.get(app.vacancy_id) || 0) + 1)
    }
  }

  const optColMap = new Map(OPTIONAL_VACANCY_COLUMNS.map((c) => [c.key, c.label]))

  const buildPaginationHref = (targetPage: number) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (sort !== 'created_desc') params.set('sort', sort)
    params.set('page', String(targetPage))
    return `/vacancies?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vacancies</h1>
          <p className="text-muted-foreground">Manage your job postings and track applicants.</p>
        </div>

        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Vacancy
          </Link>
        </Button>
      </div>

      <VacanciesToolbar
        initialSearch={search}
        initialSort={sort}
        selectedColumns={activeColumns}
      />

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Vacancies</CardTitle>
          <CardDescription>
            {totalCount ?? 0} total vacancies
            {search && ` · filtered by "${search}"`}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {vacancies.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Candidates</TableHead>
                    {activeColumns.map((col) => (
                      <TableHead key={col}>{optColMap.get(col) ?? col}</TableHead>
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
                                {formatEmploymentType(vacancy.employment_type)}
                              </p>
                            </div>
                          </Link>
                        </TableCell>

                        {/* Fixed: Status */}
                        <TableCell>
                          {status ? (
                            <Badge variant="secondary" className={VACANCY_STATUS_COLORS[status.code]}>
                              {status.name}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unknown</Badge>
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
                                    {vacancy.location || 'Remote'}
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
                                  {formatEmploymentType(vacancy.employment_type)}
                                </TableCell>
                              )
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
                            default:
                              return <TableCell key={col}>—</TableCell>
                          }
                        })}

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/vacancies/${vacancy.id}`}>View details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/vacancies/${vacancy.id}/edit`}>Edit vacancy</Link>
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-2 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {from + 1}–{Math.min(to + 1, totalCount ?? 0)} of {totalCount ?? 0}
                  </p>
                  <div className="flex items-center gap-2">
                    {page > 1 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPaginationHref(page - 1)}>Previous</Link>
                      </Button>
                    )}
                    {page < totalPages && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPaginationHref(page + 1)}>Next</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {search ? `No vacancies matching "${search}"` : 'No vacancies yet'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search
                  ? 'Try a different search term.'
                  : 'Get started by creating your first job posting.'}
              </p>
              {!search && (
                <Button className="mt-4" asChild>
                  <Link href="/vacancies/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Vacancy
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

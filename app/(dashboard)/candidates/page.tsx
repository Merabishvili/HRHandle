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
import { Plus, Users, Mail, Phone, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CandidateStatusActions } from '@/components/candidates/candidate-status-actions'
import { CandidatesToolbar } from '@/components/candidates/candidates-toolbar'
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types/candidate'
import {
  DEFAULT_CANDIDATE_COLUMNS,
  OPTIONAL_CANDIDATE_COLUMNS,
} from '@/lib/types/columns'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 20

type SearchParams = Promise<{
  vacancy?: string
  page?: string
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
  created_at: string
  updated_at: string
}

interface CandidateStatusOption {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
  sort_order: number
}

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  applied_at: string
  vacancies: { id: string; title: string }[] | { id: string; title: string } | null
}

interface VacancyOption {
  id: string
  title: string
}

function getCandidateFullName(candidate: Pick<CandidateRow, 'first_name' | 'last_name'>): string {
  return `${candidate.first_name} ${candidate.last_name}`.trim()
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
  const { vacancy: vacancyFilter, page: pageParam, search = '', sort = 'created_desc', status: statusFilter } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, column_preferences')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) return null

  const organizationId = profile.organization_id
  const colPrefs = (profile.column_preferences as Record<string, string[]>) || {}
  const activeColumns: string[] = colPrefs.candidates?.length
    ? colPrefs.candidates
    : DEFAULT_CANDIDATE_COLUMNS

  const { data: candidateStatusesRaw } = await supabase
    .from('candidate_statuses')
    .select('id, name, code, sort_order')
    .order('sort_order', { ascending: true })

  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusOption[]
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

  const FIELDS = `
    id, first_name, last_name, email, phone, current_company,
    current_position, years_of_experience, source, general_status_id,
    created_at, updated_at
  `

  let baseQuery = supabase
    .from('candidates')
    .select(FIELDS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  // Search filter
  if (search.trim()) {
    baseQuery = baseQuery.or(
      `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%`
    )
  }

  // Status filter
  if (statusFilter) {
    baseQuery = baseQuery.eq('general_status_id', statusFilter)
  }

  // Vacancy filter
  if (vacancyFilter) {
    if (!candidateIdsForFilter || candidateIdsForFilter.length === 0) {
      baseQuery = baseQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      baseQuery = baseQuery.in('id', candidateIdsForFilter)
    }
  }

  // Status sort: fetch all then sort in-memory (status is in a related table)
  let candidates: CandidateRow[]
  let totalCount: number | null

  if (sort === 'status') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allRaw, count } = await (baseQuery as any).order('created_at', { ascending: false })
    totalCount = count
    const statusSortOrder = new Map(candidateStatuses.map((s) => [s.id, s.sort_order]))
    const sorted = ((allRaw || []) as CandidateRow[]).sort((a, b) => {
      const aOrder = a.general_status_id ? (statusSortOrder.get(a.general_status_id) ?? 999) : 999
      const bOrder = b.general_status_id ? (statusSortOrder.get(b.general_status_id) ?? 999) : 999
      return aOrder - bOrder
    })
    candidates = sorted.slice(from, to + 1)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortedQuery: any = baseQuery
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
      default:
        sortedQuery = baseQuery.order('created_at', { ascending: false })
    }
    const result = await sortedQuery.range(from, to)
    candidates = (result.data || []) as CandidateRow[]
    totalCount = result.count
  }

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  // Fetch applications for this page of candidates
  const candidateIds = candidates.map((c) => c.id)
  const { data: vacancyOptionsRaw } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  const vacancyOptions = (vacancyOptionsRaw || []) as VacancyOption[]
  const vacancyMap = new Map(vacancyOptions.map((v) => [v.id, v]))

  let applications: ApplicationRow[] = []
  if (candidateIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select('id, candidate_id, vacancy_id, applied_at, vacancies(id, title)')
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

  // Build column label map for header
  const optColMap = new Map(OPTIONAL_CANDIDATE_COLUMNS.map((c) => [c.key, c.label]))

  const buildPaginationHref = (targetPage: number) => {
    const params = new URLSearchParams()
    if (vacancyFilter) params.set('vacancy', vacancyFilter)
    if (search) params.set('search', search)
    if (sort !== 'created_desc') params.set('sort', sort)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(targetPage))
    return `/candidates?${params.toString()}`
  }

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
          <Button asChild>
            <Link href={vacancyFilter ? `/candidates/new?vacancy=${vacancyFilter}` : '/candidates/new'}>
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Link>
          </Button>
        </div>
      </div>

      <CandidatesToolbar
        initialSearch={search}
        initialSort={sort}
        initialStatus={statusFilter || ''}
        selectedColumns={activeColumns}
        statusOptions={candidateStatuses}
      />

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Candidates</CardTitle>
          <CardDescription>
            {totalCount ?? 0} total candidates
            {search && ` · filtered by "${search}"`}
            {totalPages > 1 && ` · page ${page} of ${totalPages}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {candidates.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linked Vacancy</TableHead>
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
                                <Link href={`/candidates/${candidate.id}`}>View details</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/candidates/${candidate.id}/edit`}>Edit candidate</Link>
                              </DropdownMenuItem>
                              <CandidateStatusActions
                                candidateId={candidate.id}
                                currentStatusId={candidate.general_status_id}
                                statusOptions={candidateStatuses}
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
                    Add Candidate
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

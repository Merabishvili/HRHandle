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
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 20

type SearchParams = Promise<{ vacancy?: string; page?: string }>

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
  code: 'new' | 'active' | 'in_process' | 'hired' | 'rejected' | 'archived'
}

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  applied_at: string
  vacancies:
    | {
        id: string
        title: string
      }[]
    | null
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

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { vacancy: vacancyFilter, page: pageParam } = await searchParams
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
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return null
  }

  const organizationId = profile.organization_id

  const { data: candidateStatusesRaw } = await supabase
    .from('candidate_statuses')
    .select('id, name, code, sort_order')
    .order('sort_order', { ascending: true })

  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusOption[]
  const statusMap = new Map(candidateStatuses.map((status) => [status.id, status]))

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
    id,
    first_name,
    last_name,
    email,
    phone,
    current_company,
    current_position,
    years_of_experience,
    source,
    general_status_id,
    created_at,
    updated_at
  `

  let candidatesQuery = supabase
    .from('candidates')
    .select(FIELDS, { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (vacancyFilter) {
    if (!candidateIdsForFilter || candidateIdsForFilter.length === 0) {
      candidatesQuery = supabase
        .from('candidates')
        .select(FIELDS, { count: 'exact' })
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .in('id', ['00000000-0000-0000-0000-000000000000'])
        .range(from, to)
    } else {
      candidatesQuery = candidatesQuery.in('id', candidateIdsForFilter)
    }
  }

  const { data: candidatesRaw, count: totalCount } = await candidatesQuery
  const candidates = (candidatesRaw || []) as CandidateRow[]
  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  const candidateIds = candidates.map((candidate) => candidate.id)

  const { data: vacancyOptionsRaw } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  const vacancyOptions = (vacancyOptionsRaw || []) as VacancyOption[]
  const vacancyMap = new Map(vacancyOptions.map((vacancy) => [vacancy.id, vacancy]))

  let applications: ApplicationRow[] = []
  if (candidateIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select(`
        id,
        candidate_id,
        vacancy_id,
        applied_at,
        vacancies (
          id,
          title
        )
      `)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('candidate_id', candidateIds)

    applications = (applicationsRaw || []) as ApplicationRow[]
  }

  const applicationsByCandidate = new Map<string, ApplicationRow[]>()
  for (const application of applications) {
    const existing = applicationsByCandidate.get(application.candidate_id) || []
    existing.push(application)
    applicationsByCandidate.set(application.candidate_id, existing)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-muted-foreground">
            {filterVacancyTitle
              ? `Showing candidates linked to vacancy: ${filterVacancyTitle}`
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

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Candidates</CardTitle>
          <CardDescription>
            {totalCount ?? 0} total candidates
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
                    <TableHead>Current Position</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Linked Vacancies</TableHead>
                    <TableHead>General Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {candidates.map((candidate) => {
                    const fullName = getCandidateFullName(candidate)
                    const initials = getCandidateInitials(candidate)
                    const candidateApplications = applicationsByCandidate.get(candidate.id) || []

                    const firstApplication = candidateApplications[0]
                    const relatedVacancy = firstApplication?.vacancies?.[0] || null
                    const fallbackVacancy = firstApplication?.vacancy_id
                      ? vacancyMap.get(firstApplication.vacancy_id)
                      : null
                    const firstVacancyTitle = relatedVacancy?.title || fallbackVacancy?.title || null

                    const extraVacanciesCount =
                      candidateApplications.length > 1 ? candidateApplications.length - 1 : 0

                    const status = candidate.general_status_id
                      ? statusMap.get(candidate.general_status_id)
                      : null

                    return (
                      <TableRow key={candidate.id}>
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

                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm text-foreground">
                              {candidate.current_position || 'Not specified'}
                            </p>
                            {candidate.current_company && (
                              <p className="text-xs text-muted-foreground">
                                {candidate.current_company}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            {candidate.email ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {candidate.email}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No email</div>
                            )}

                            {candidate.phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {candidate.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {candidateApplications.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-sm text-foreground">{firstVacancyTitle || 'Unknown vacancy'}</p>
                              {extraVacanciesCount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  +{extraVacanciesCount} more
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not linked</span>
                          )}
                        </TableCell>

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

                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(candidate.updated_at), { addSuffix: true })}
                        </TableCell>

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
                        <Link
                          href={`/candidates?${new URLSearchParams({
                            ...(vacancyFilter ? { vacancy: vacancyFilter } : {}),
                            page: String(page - 1),
                          })}`}
                        >
                          Previous
                        </Link>
                      </Button>
                    )}
                    {page < totalPages && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/candidates?${new URLSearchParams({
                            ...(vacancyFilter ? { vacancy: vacancyFilter } : {}),
                            page: String(page + 1),
                          })}`}
                        >
                          Next
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No candidates yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start adding candidates to track your hiring pipeline.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/candidates/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Candidate
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
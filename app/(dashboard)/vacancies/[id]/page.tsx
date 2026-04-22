import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  Edit,
  MapPin,
  Briefcase,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  VACANCY_STATUS_COLORS,
  CANDIDATE_GENERAL_STATUS_COLORS,
} from '@/lib/types'

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
    | {
        id: string
        name: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
      }[]
    | null
  sectors:
    | {
        id: string
        name: string
        code: string
      }[]
    | null
}

interface VacancyStatusRow {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
}

interface SectorRow {
  id: string
  name: string
  code: string
}

interface CandidateGeneralStatusRow {
  id: string
  name: string
  code: 'new' | 'active' | 'in_process' | 'hired' | 'rejected' | 'archived'
}

interface ApplicationCandidateRow {
  id: string
  candidate_id: string
  vacancy_id: string
  status_id: string | null
  applied_at: string
  candidates:
    | {
        id: string
        first_name: string
        last_name: string
        general_status_id: string | null
      }[]
    | null
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  general_status_id: string | null
}

function formatEmploymentType(value: VacancyRow['employment_type']): string {
  if (!value) return 'Not specified'

  switch (value) {
    case 'full_time':
      return 'Full-time'
    case 'part_time':
      return 'Part-time'
    case 'contract':
      return 'Contract'
    case 'internship':
      return 'Internship'
    default:
      return value
  }
}

function formatSalary(vacancy: VacancyRow): string | null {
  if (vacancy.salary_min == null && vacancy.salary_max == null) return null

  const min = vacancy.salary_min != null ? vacancy.salary_min.toLocaleString() : null
  const max = vacancy.salary_max != null ? vacancy.salary_max.toLocaleString() : null

  if (min && max) return `${vacancy.salary_currency} ${min} - ${max}`
  if (min) return `${vacancy.salary_currency} ${min}+`
  if (max) return `Up to ${vacancy.salary_currency} ${max}`

  return null
}

function getCandidateFullName(candidate?: { first_name: string; last_name: string } | null): string {
  if (!candidate) return 'Unknown candidate'
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

function getCandidateInitials(candidate?: { first_name: string; last_name: string } | null): string {
  if (!candidate) return '?'
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) {
    redirect('/dashboard')
  }

  const [
    { data: vacancyRaw },
    { data: vacancyStatusesRaw },
    { data: sectorsRaw },
    { data: candidateStatusesRaw },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select(`
        id,
        organization_id,
        title,
        sector_id,
        status_id,
        department,
        location,
        employment_type,
        hiring_manager_name,
        salary_min,
        salary_max,
        salary_currency,
        openings_count,
        start_date,
        end_date,
        description,
        requirements,
        created_by,
        created_at,
        updated_at,
        archived_at,
        vacancy_statuses (
          id,
          name,
          code
        ),
        sectors (
          id,
          name,
          code
        )
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .single(),

    supabase
      .from('vacancy_statuses')
      .select('id, name, code')
      .order('sort_order', { ascending: true }),

    supabase
      .from('sectors')
      .select('id, name, code')
      .order('name', { ascending: true }),

    supabase
      .from('candidate_statuses')
      .select('id, name, code')
      .order('sort_order', { ascending: true }),
  ])

  const vacancy = vacancyRaw as VacancyRow | null

  if (!vacancy) {
    notFound()
  }

  const vacancyStatuses = (vacancyStatusesRaw || []) as VacancyStatusRow[]
  const sectors = (sectorsRaw || []) as SectorRow[]
  const candidateStatuses = (candidateStatusesRaw || []) as CandidateGeneralStatusRow[]

  const candidateStatusMap = new Map(candidateStatuses.map((status) => [status.id, status]))

  const { data: applicationsRaw, count: applicantsCount } = await supabase
    .from('applications')
    .select(
      `
      id,
      candidate_id,
      vacancy_id,
      status_id,
      applied_at,
      candidates (
        id,
        first_name,
        last_name,
        general_status_id
      )
    `,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .eq('vacancy_id', id)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })
    .limit(5)

  const recentApplications = (applicationsRaw || []) as ApplicationCandidateRow[]

  const candidateIdsNeedingFallback = recentApplications
    .filter((application) => !application.candidates?.[0] && application.candidate_id)
    .map((application) => application.candidate_id)

  let fallbackCandidatesMap = new Map<string, CandidateRow>()
  if (candidateIdsNeedingFallback.length > 0) {
    const { data: fallbackCandidatesRaw } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, general_status_id')
      .in('id', candidateIdsNeedingFallback)

    const fallbackCandidates = (fallbackCandidatesRaw || []) as CandidateRow[]
    fallbackCandidatesMap = new Map(fallbackCandidates.map((candidate) => [candidate.id, candidate]))
  }

  const vacancyStatus =
    vacancy.vacancy_statuses?.[0] ||
    vacancyStatuses.find((status) => status.id === vacancy.status_id) ||
    null

  const sector =
    vacancy.sectors?.[0] ||
    sectors.find((item) => item.id === vacancy.sector_id) ||
    null

  const salaryText = formatSalary(vacancy)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/vacancies">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>

              {vacancyStatus ? (
                <Badge
                  variant="secondary"
                  className={VACANCY_STATUS_COLORS[vacancyStatus.code]}
                >
                  {vacancyStatus.name}
                </Badge>
              ) : (
                <Badge variant="secondary">Unknown</Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {vacancy.department && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {vacancy.department}
                </span>
              )}

              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {vacancy.location || 'Remote'}
              </span>

              {salaryText && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {salaryText}
                </span>
              )}

              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Posted {formatDistanceToNow(new Date(vacancy.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        <Button asChild>
          <Link href={`/vacancies/${id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Vacancy
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {vacancy.description && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {vacancy.description}
                </div>
              </CardContent>
            </Card>
          )}

          {vacancy.requirements && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {vacancy.requirements}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employment</span>
                <span className="text-sm font-medium">
                  {formatEmploymentType(vacancy.employment_type)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Applicants</span>
                <span className="text-sm font-medium">{applicantsCount || 0}</span>
              </div>

              {sector && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sector</span>
                  <span className="text-sm font-medium">{sector.name}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {vacancyStatus ? (
                  <Badge
                    variant="secondary"
                    className={VACANCY_STATUS_COLORS[vacancyStatus.code]}
                  >
                    {vacancyStatus.name}
                  </Badge>
                ) : (
                  <span className="text-sm font-medium">Unknown</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Openings</span>
                <span className="text-sm font-medium">{vacancy.openings_count}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <span className="text-sm font-medium">
                  {new Date(vacancy.start_date).toLocaleDateString()}
                </span>
              </div>

              {vacancy.end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">End Date</span>
                  <span className="text-sm font-medium">
                    {new Date(vacancy.end_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Applicants</CardTitle>
                <CardDescription>{applicantsCount || 0} total</CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {recentApplications.length > 0 ? (
                <div className="space-y-3">
                  {recentApplications.map((application) => {
                    const relatedCandidate = application.candidates?.[0] || null
                    const fallbackCandidate = fallbackCandidatesMap.get(application.candidate_id) || null
                    const candidate = relatedCandidate || fallbackCandidate

                    const generalStatus = candidate?.general_status_id
                      ? candidateStatusMap.get(candidate.general_status_id)
                      : null

                    return (
                      <Link
                        key={application.id}
                        href={`/candidates/${application.candidate_id}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-xs font-medium text-primary">
                            {getCandidateInitials(candidate)}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
  {getCandidateFullName(candidate)}
</p>

{generalStatus ? (
  <Badge
    variant="secondary"
    className={CANDIDATE_GENERAL_STATUS_COLORS[generalStatus.code]}
  >
    {generalStatus.name}
  </Badge>
) : (
  <p className="text-xs text-muted-foreground">No status</p>
)}
                        </div>
                      </Link>
                    )
                  })}

                  {applicantsCount && applicantsCount > 5 && (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <Link href={`/candidates?vacancy=${id}`}>
                        View all {applicantsCount} applicants
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No applicants yet</p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href={`/candidates/new?vacancy=${id}`}>
                      Add candidate
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
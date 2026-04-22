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
import { VACANCY_STATUS_COLORS } from '@/lib/types'

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
    | {
        id: string
        name: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
      }[]
    | null
}

interface ApplicationCountRow {
  vacancy_id: string
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

export default async function VacanciesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) return null

  const [{ data: statusOptionsRaw }, { data: vacanciesRaw }] = await Promise.all([
    supabase
      .from('vacancy_statuses')
      .select('id, name, code, is_active, sort_order')
      .order('sort_order', { ascending: true }),

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
        )
      `)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  ])

  const statusOptions = (statusOptionsRaw || []) as VacancyStatusOption[]
  const vacancies = (vacanciesRaw || []) as VacancyRow[]

  const vacancyIds = vacancies.map((vacancy) => vacancy.id)

  let applications: ApplicationCountRow[] = []
  if (vacancyIds.length > 0) {
    const { data: applicationsRaw } = await supabase
      .from('applications')
      .select('vacancy_id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('vacancy_id', vacancyIds)

    applications = (applicationsRaw || []) as ApplicationCountRow[]
  }

  const applicationCounts = new Map<string, number>()
  for (const application of applications) {
    const current = applicationCounts.get(application.vacancy_id) || 0
    applicationCounts.set(application.vacancy_id, current + 1)
  }

  const vacanciesWithCount = vacancies.map((vacancy) => {
    const relatedStatus = vacancy.vacancy_statuses?.[0] || null
    const fallbackStatus =
      statusOptions.find((status) => status.id === vacancy.status_id) || null

    return {
      ...vacancy,
      candidates_count: applicationCounts.get(vacancy.id) || 0,
      status: relatedStatus || fallbackStatus,
    }
  })

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

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Vacancies</CardTitle>
          <CardDescription>{vacanciesWithCount.length} total vacancies</CardDescription>
        </CardHeader>

        <CardContent>
          {vacanciesWithCount.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Candidates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {vacanciesWithCount.map((vacancy) => (
                    <TableRow key={vacancy.id}>
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

                      <TableCell className="text-muted-foreground">
                        {vacancy.department || '-'}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {vacancy.location || 'Remote'}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {vacancy.candidates_count}
                        </div>
                      </TableCell>

                      <TableCell>
                        {vacancy.status ? (
                          <Badge
                            variant="secondary"
                            className={VACANCY_STATUS_COLORS[vacancy.status.code]}
                          >
                            {vacancy.status.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unknown</Badge>
                        )}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No vacancies yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first job posting.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/vacancies/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Vacancy
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
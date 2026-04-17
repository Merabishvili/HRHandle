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
import { VACANCY_STATUS_COLORS, type VacancyStatus } from '@/lib/types'

export default async function VacanciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: vacancies } = await supabase
    .from('vacancies')
    .select(`
      *,
      candidates:candidates(count)
    `)
    .eq('organization_id', profile?.organization_id!)
    .order('created_at', { ascending: false })

  const vacanciesWithCount = vacancies?.map(v => ({
    ...v,
    candidates_count: v.candidates?.[0]?.count || 0
  })) || []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

      {/* Vacancies Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Vacancies</CardTitle>
          <CardDescription>
            {vacanciesWithCount.length} total vacancies
          </CardDescription>
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
                    <TableHead className="w-[70px]"></TableHead>
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
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{vacancy.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {vacancy.employment_type.replace('-', ' ')}
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
                        <Badge 
                          variant="secondary" 
                          className={VACANCY_STATUS_COLORS[vacancy.status as VacancyStatus]}
                        >
                          {vacancy.status}
                        </Badge>
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
                            <VacancyActions vacancyId={vacancy.id} currentStatus={vacancy.status} />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
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

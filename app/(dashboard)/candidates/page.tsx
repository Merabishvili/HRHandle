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
import { Plus, Users, Mail, Phone, MoreHorizontal, Star } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CandidateStatusActions } from '@/components/candidates/candidate-status-actions'
import { CANDIDATE_STATUS_COLORS, type CandidateStatus } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ vacancy?: string }>
}) {
  const { vacancy: vacancyFilter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let query = supabase
    .from('candidates')
    .select(`
      *,
      vacancies(id, title)
    `)
    .eq('organization_id', profile?.organization_id!)
    .order('created_at', { ascending: false })

  if (vacancyFilter) {
    query = query.eq('vacancy_id', vacancyFilter)
  }

  const { data: candidates } = await query

  // Get vacancy title for filter display
  let filterVacancyTitle = null
  if (vacancyFilter) {
    const { data: vacancy } = await supabase
      .from('vacancies')
      .select('title')
      .eq('id', vacancyFilter)
      .single()
    filterVacancyTitle = vacancy?.title
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-muted-foreground">
            {filterVacancyTitle 
              ? `Showing candidates for: ${filterVacancyTitle}`
              : 'Track and manage your candidate pipeline.'}
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

      {/* Candidates Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Candidates</CardTitle>
          <CardDescription>
            {candidates?.length || 0} total candidates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidates && candidates.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <Link 
                          href={`/candidates/${candidate.id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{candidate.full_name}</p>
                            {candidate.source && (
                              <p className="text-xs text-muted-foreground">via {candidate.source}</p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {candidate.vacancies?.title || 'Not assigned'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {candidate.email}
                          </div>
                          {candidate.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {candidate.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {candidate.rating ? (
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`h-4 w-4 ${i < candidate.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} 
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={CANDIDATE_STATUS_COLORS[candidate.status as CandidateStatus]}
                        >
                          {candidate.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(candidate.applied_at), { addSuffix: true })}
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
                              currentStatus={candidate.status} 
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
            <div className="text-center py-12">
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

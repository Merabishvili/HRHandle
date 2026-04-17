import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Edit, 
  MapPin, 
  Briefcase, 
  DollarSign,
  Users,
  Clock
} from 'lucide-react'
import { VACANCY_STATUS_COLORS, type VacancyStatus } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: vacancy } = await supabase
    .from('vacancies')
    .select('*')
    .eq('id', id)
    .single()

  if (!vacancy) {
    notFound()
  }

  // Get candidates for this vacancy
  const { data: candidates, count: candidatesCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact' })
    .eq('vacancy_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const formatSalary = () => {
    if (!vacancy.salary_min && !vacancy.salary_max) return null
    const min = vacancy.salary_min?.toLocaleString()
    const max = vacancy.salary_max?.toLocaleString()
    if (min && max) return `${vacancy.salary_currency} ${min} - ${max}`
    if (min) return `${vacancy.salary_currency} ${min}+`
    if (max) return `Up to ${vacancy.salary_currency} ${max}`
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/vacancies">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
              <Badge 
                variant="secondary" 
                className={VACANCY_STATUS_COLORS[vacancy.status as VacancyStatus]}
              >
                {vacancy.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
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
              {formatSalary() && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {formatSalary()}
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
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {vacancy.description && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
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
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                  {vacancy.requirements}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employment</span>
                <span className="text-sm font-medium capitalize">
                  {vacancy.employment_type.replace('-', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Applicants</span>
                <span className="text-sm font-medium">{candidatesCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant="secondary" 
                  className={VACANCY_STATUS_COLORS[vacancy.status as VacancyStatus]}
                >
                  {vacancy.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Candidates */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Applicants</CardTitle>
                <CardDescription>{candidatesCount || 0} total</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {candidates && candidates.length > 0 ? (
                <div className="space-y-3">
                  {candidates.map((candidate) => (
                    <Link
                      key={candidate.id}
                      href={`/candidates/${candidate.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {candidate.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {candidate.status}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {candidatesCount && candidatesCount > 5 && (
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <Link href={`/candidates?vacancy=${id}`}>
                        View all {candidatesCount} applicants
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
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

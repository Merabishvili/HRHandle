import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Edit, 
  Mail, 
  Phone,
  Linkedin,
  Briefcase,
  Calendar,
  Star,
  Clock
} from 'lucide-react'
import { CANDIDATE_STATUS_COLORS, type CandidateStatus } from '@/lib/types'
import { formatDistanceToNow, format } from 'date-fns'
import { CandidateStatusSelect } from '@/components/candidates/candidate-status-select'

export default async function CandidateDetailPage({
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

  const { data: candidate } = await supabase
    .from('candidates')
    .select(`
      *,
      vacancies(id, title, department)
    `)
    .eq('id', id)
    .single()

  if (!candidate) {
    notFound()
  }

  // Get interviews for this candidate
  const { data: interviews } = await supabase
    .from('interviews')
    .select(`
      *,
      profiles(full_name)
    `)
    .eq('candidate_id', id)
    .order('scheduled_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-primary">
                {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{candidate.full_name}</h1>
                <Badge 
                  variant="secondary" 
                  className={CANDIDATE_STATUS_COLORS[candidate.status as CandidateStatus]}
                >
                  {candidate.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                {candidate.vacancies && (
                  <Link 
                    href={`/vacancies/${candidate.vacancies.id}`}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Briefcase className="h-4 w-4" />
                    {candidate.vacancies.title}
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Applied {formatDistanceToNow(new Date(candidate.applied_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CandidateStatusSelect candidateId={candidate.id} currentStatus={candidate.status} />
          <Button asChild>
            <Link href={`/candidates/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${candidate.email}`} className="text-foreground hover:underline">
                    {candidate.email}
                  </a>
                </div>
              </div>
              {candidate.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <a href={`tel:${candidate.phone}`} className="text-foreground hover:underline">
                      {candidate.phone}
                    </a>
                  </div>
                </div>
              )}
              {candidate.linkedin_url && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Linkedin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">LinkedIn</p>
                    <a 
                      href={candidate.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline"
                    >
                      View Profile
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {candidate.notes && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{candidate.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Interviews */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Interviews</CardTitle>
                <CardDescription>Scheduled and past interviews</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link href={`/interviews/new?candidate=${id}&vacancy=${candidate.vacancy_id}`}>
                  Schedule Interview
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {interviews && interviews.length > 0 ? (
                <div className="space-y-4">
                  {interviews.map((interview) => (
                    <div 
                      key={interview.id} 
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground capitalize">
                            {interview.type} Interview
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {interview.profiles?.full_name || 'No interviewer assigned'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {format(new Date(interview.scheduled_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(interview.scheduled_at), 'h:mm a')}
                        </p>
                        <Badge variant="secondary" className="mt-1 capitalize">
                          {interview.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No interviews scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant="secondary" 
                  className={CANDIDATE_STATUS_COLORS[candidate.status as CandidateStatus]}
                >
                  {candidate.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <span className="text-sm font-medium">{candidate.source || 'Not specified'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rating</span>
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
                  <span className="text-sm font-medium">Not rated</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Applied</span>
                <span className="text-sm font-medium">
                  {format(new Date(candidate.applied_at), 'MMM d, yyyy')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Position */}
          {candidate.vacancies && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Position</CardTitle>
              </CardHeader>
              <CardContent>
                <Link 
                  href={`/vacancies/${candidate.vacancies.id}`}
                  className="block p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <p className="font-medium text-foreground">{candidate.vacancies.title}</p>
                  {candidate.vacancies.department && (
                    <p className="text-sm text-muted-foreground">{candidate.vacancies.department}</p>
                  )}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

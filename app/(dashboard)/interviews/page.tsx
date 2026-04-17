import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, Video, Phone, Building, Clock } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'

export default async function InterviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  // Get interviews with candidates and vacancies
  const { data: interviews } = await supabase
    .from('interviews')
    .select(`
      *,
      candidates(id, full_name),
      vacancies!inner(id, title, organization_id),
      profiles(full_name)
    `)
    .eq('vacancies.organization_id', profile?.organization_id!)
    .order('scheduled_at', { ascending: true })

  // Group interviews by status
  const upcomingInterviews = interviews?.filter(i => 
    !isPast(new Date(i.scheduled_at)) && i.status === 'scheduled'
  ) || []
  const pastInterviews = interviews?.filter(i => 
    isPast(new Date(i.scheduled_at)) || i.status !== 'scheduled'
  ) || []

  const getInterviewIcon = (type: string) => {
    switch (type) {
      case 'video': return Video
      case 'phone': return Phone
      case 'onsite': return Building
      default: return Calendar
    }
  }

  const getTimeLabel = (date: Date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'MMM d, yyyy')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      case 'no_show': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interviews</h1>
          <p className="text-muted-foreground">Manage and schedule candidate interviews.</p>
        </div>
        <Button asChild>
          <Link href="/interviews/new">
            <Plus className="mr-2 h-4 w-4" />
            Schedule Interview
          </Link>
        </Button>
      </div>

      {/* Upcoming Interviews */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Upcoming Interviews</CardTitle>
          <CardDescription>
            {upcomingInterviews.length} scheduled interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-4">
              {upcomingInterviews.map((interview) => {
                const Icon = getInterviewIcon(interview.type)
                const scheduledDate = new Date(interview.scheduled_at)
                return (
                  <div 
                    key={interview.id} 
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <Link 
                          href={`/candidates/${interview.candidates?.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {interview.candidates?.full_name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {interview.vacancies?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Interviewer: {interview.profiles?.full_name || 'Not assigned'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {getTimeLabel(scheduledDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(scheduledDate, 'h:mm a')} ({interview.duration_minutes} min)
                      </p>
                      <Badge variant="secondary" className={`mt-1 capitalize ${getStatusColor(interview.status)}`}>
                        {interview.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No upcoming interviews</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Schedule interviews with your candidates.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/interviews/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Interview
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Interviews */}
      {pastInterviews.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Past Interviews</CardTitle>
            <CardDescription>
              {pastInterviews.length} completed or cancelled interviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastInterviews.slice(0, 10).map((interview) => {
                const Icon = getInterviewIcon(interview.type)
                const scheduledDate = new Date(interview.scheduled_at)
                return (
                  <div 
                    key={interview.id} 
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 opacity-75"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <Link 
                          href={`/candidates/${interview.candidates?.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {interview.candidates?.full_name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {interview.vacancies?.title}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {format(scheduledDate, 'MMM d, yyyy')}
                      </p>
                      <Badge variant="secondary" className={`mt-1 capitalize ${getStatusColor(interview.status)}`}>
                        {interview.status}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

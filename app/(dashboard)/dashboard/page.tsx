import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Briefcase, 
  Users, 
  Calendar, 
  TrendingUp,
  Plus,
  ArrowRight,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get profile with organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id

  // Fetch stats in parallel
  const [
    { count: totalVacancies },
    { count: activeVacancies },
    { count: totalCandidates },
    { count: newCandidates },
    { data: upcomingInterviews },
    { data: recentCandidates },
    { data: recentVacancies },
  ] = await Promise.all([
    supabase.from('vacancies').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!),
    supabase.from('vacancies').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!).eq('status', 'active'),
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!),
    supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('organization_id', orgId!).eq('status', 'new'),
    supabase
      .from('interviews')
      .select('*, candidates(full_name), vacancies(title)')
      .gte('scheduled_at', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabase
      .from('candidates')
      .select('*, vacancies(title)')
      .eq('organization_id', orgId!)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('vacancies')
      .select('*')
      .eq('organization_id', orgId!)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const stats = [
    {
      title: 'Total Vacancies',
      value: totalVacancies || 0,
      icon: Briefcase,
      change: `${activeVacancies || 0} active`,
      href: '/vacancies',
    },
    {
      title: 'Total Candidates',
      value: totalCandidates || 0,
      icon: Users,
      change: `${newCandidates || 0} new`,
      href: '/candidates',
    },
    {
      title: 'Interviews Scheduled',
      value: upcomingInterviews?.length || 0,
      icon: Calendar,
      change: 'Upcoming',
      href: '/interviews',
    },
    {
      title: 'Hiring Rate',
      value: totalCandidates ? '---' : '0%',
      icon: TrendingUp,
      change: 'This month',
      href: '/candidates',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of your hiring activity.</p>
        </div>
        <Button asChild>
          <Link href="/vacancies/new">
            <Plus className="mr-2 h-4 w-4" />
            New Vacancy
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Candidates */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Candidates</CardTitle>
              <CardDescription>Latest candidates who applied</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/candidates">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentCandidates && recentCandidates.length > 0 ? (
              <div className="space-y-4">
                {recentCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {candidate.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{candidate.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.vacancies?.title || 'No position assigned'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(candidate.created_at), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No candidates yet</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/candidates/new">Add candidate</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Vacancies */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Vacancies</CardTitle>
              <CardDescription>Your latest job postings</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vacancies">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentVacancies && recentVacancies.length > 0 ? (
              <div className="space-y-4">
                {recentVacancies.map((vacancy) => (
                  <div key={vacancy.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{vacancy.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {vacancy.department || 'No department'} • {vacancy.location || 'Remote'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                      vacancy.status === 'active' ? 'bg-green-100 text-green-800' :
                      vacancy.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      vacancy.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {vacancy.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No vacancies yet</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/vacancies/new">Create vacancy</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Interviews */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Interviews</CardTitle>
              <CardDescription>Scheduled interviews for the coming days</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/interviews">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingInterviews && upcomingInterviews.length > 0 ? (
              <div className="space-y-4">
                {upcomingInterviews.map((interview) => (
                  <div key={interview.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {interview.candidates?.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {interview.vacancies?.title}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(interview.scheduled_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(interview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No upcoming interviews</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

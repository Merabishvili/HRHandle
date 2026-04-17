import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InterviewForm } from '@/components/interviews/interview-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string; vacancy?: string }>
}) {
  const { candidate: candidateId, vacancy: vacancyId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  // Get candidates for dropdown
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name, vacancy_id')
    .eq('organization_id', profile.organization_id)
    .order('full_name')

  // Get vacancies for dropdown
  const { data: vacancies } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('organization_id', profile.organization_id)
    .in('status', ['active', 'draft'])
    .order('title')

  // Get team members for interviewer dropdown
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('organization_id', profile.organization_id)
    .order('full_name')

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/interviews">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule Interview</h1>
          <p className="text-muted-foreground">Set up an interview with a candidate.</p>
        </div>
      </div>

      <InterviewForm 
        candidates={candidates || []}
        vacancies={vacancies || []}
        teamMembers={teamMembers || []}
        defaultCandidateId={candidateId}
        defaultVacancyId={vacancyId}
      />
    </div>
  )
}

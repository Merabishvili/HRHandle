import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { InterviewForm } from '@/components/interviews/interview-form'
import { Button } from '@/components/ui/button'

interface SearchParams {
  candidate?: string
  vacancy?: string
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
}

interface VacancyStatusRow {
  id: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  name: string
}

interface VacancyRow {
  id: string
  title: string
  status_id: string | null
  vacancy_statuses:
    | {
        id: string
        code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
        name: string
      }[]
    | null
}

interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
}

interface TeamMemberRow {
  id: string
  full_name: string
}

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { candidate: candidateId, vacancy: vacancyId } = await searchParams
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

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  const organizationId = profile.organization_id

  const [{ data: candidatesRaw }, { data: vacancyStatusesRaw }, { data: vacanciesRaw }] =
    await Promise.all([
      supabase
        .from('candidates')
        .select('id, first_name, last_name')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .order('first_name', { ascending: true }),

      supabase
        .from('vacancy_statuses')
        .select('id, code, name')
        .order('sort_order', { ascending: true }),

      supabase
        .from('vacancies')
        .select(`
          id,
          title,
          status_id,
          vacancy_statuses (
            id,
            code,
            name
          )
        `)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .order('title', { ascending: true }),
    ])

  const candidates = (candidatesRaw || []) as CandidateRow[]
  const vacancyStatuses = (vacancyStatusesRaw || []) as VacancyStatusRow[]
  const vacanciesAll = (vacanciesRaw || []) as VacancyRow[]

  const vacancies = vacanciesAll.filter((vacancy) => {
    const relatedStatus = vacancy.vacancy_statuses?.[0] || null
    const fallbackStatus =
      vacancyStatuses.find((status) => status.id === vacancy.status_id) || null

    const statusCode = relatedStatus?.code || fallbackStatus?.code
    return statusCode === 'open' || statusCode === 'draft'
  })

  const { data: applicationsRaw } = await supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const applications = (applicationsRaw || []) as ApplicationRow[]

  const { data: teamMembersRaw } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true })

  const teamMembers = (teamMembersRaw || []) as TeamMemberRow[]

  return (
    <div className="max-w-3xl space-y-6">
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
        candidates={candidates}
        vacancies={vacancies}
        applications={applications}
        teamMembers={teamMembers}
        defaultCandidateId={candidateId}
        defaultVacancyId={vacancyId}
      />
    </div>
  )
}
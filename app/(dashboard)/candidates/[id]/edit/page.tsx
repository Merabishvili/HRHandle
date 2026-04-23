import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { CandidateForm } from '@/components/candidates/candidate-form'
import { Button } from '@/components/ui/button'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'

interface PageParams {
  id: string
}

interface CandidateRow {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  email: string | null
  phone: string | null
  current_company: string | null
  current_position: string | null
  years_of_experience: number | null
  linkedin_profile_url: string | null
  source: string | null
  general_status_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
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
  vacancy_statuses?: {
    id: string
    code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
    name: string
  }[] | null
}

interface CandidateStatusRow {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
  is_active: boolean
  sort_order: number
}


export default async function EditCandidatePage({
  params,
}: {
  params: Promise<PageParams>
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

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  const organizationId = profile.organization_id

  const { data: candidateRaw } = await supabase
    .from('candidates')
    .select(`
      id,
      organization_id,
      first_name,
      last_name,
      date_of_birth,
      email,
      phone,
      current_company,
      current_position,
      years_of_experience,
      linkedin_profile_url,
      source,
      general_status_id,
      created_by,
      created_at,
      updated_at,
      deleted_at
    `)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .single()

  const candidate = candidateRaw as CandidateRow | null

  if (!candidate) {
    notFound()
  }

  const { data: candidateStatusesRaw } = await supabase
    .from('candidate_statuses')
    .select('id, name, code, is_active, sort_order')
    .order('sort_order', { ascending: true })

  const candidateStatuses = (candidateStatusesRaw || []) as CandidateStatusRow[]

const { data: vacanciesRaw } = await supabase
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
      code,
      name
    )
  `)
  .eq('organization_id', organizationId)
  .is('archived_at', null)
  .order('title', { ascending: true })

  const vacanciesAll = (vacanciesRaw || []) as VacancyRow[]

  const vacancies = vacanciesAll.filter((vacancy) => {
    const statusCode = vacancy.vacancy_statuses?.[0]?.code
    return statusCode === 'open' || statusCode === 'draft'
  })

  const [customFieldGroups, customFieldValues] = await Promise.all([
    getCustomFieldSchema('candidate'),
    getCustomFieldValues(id),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/candidates/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Candidate</h1>
          <p className="text-muted-foreground">Update candidate information.</p>
        </div>
      </div>

      <CandidateForm
        candidate={candidate}
        vacancies={vacancies}
        candidateStatuses={candidateStatuses}
        customFieldGroups={customFieldGroups}
        customFieldValues={customFieldValues}
      />
    </div>
  )
}
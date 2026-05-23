import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { CandidateForm } from '@/components/candidates/candidate-form'
import { ExperienceSection } from '@/components/candidates/experience-section'
import { EducationSection } from '@/components/candidates/education-section'
import { Button } from '@/components/ui/button'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { getCandidateStatuses } from '@/lib/cache/lookups'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'

interface PageParams {
  id: string
}

interface CandidateRow {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  linkedin_profile_url: string | null
  location: string | null
  timezone: string | null
  languages: string[]
  salary_expectation: string | null
  notice_period: string | null
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
  responsibilities: string | null
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

import type { CandidateStatusOption as CandidateStatusRow } from '@/lib/types/database'


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
      email,
      phone,
      linkedin_profile_url,
      location,
      timezone,
      languages,
      salary_expectation,
      notice_period,
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

  const candidateStatuses = (await getCandidateStatuses()) as CandidateStatusRow[]

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
    responsibilities,
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
  .is('deleted_at', null)
  .order('title', { ascending: true })

  const vacanciesAll = (vacanciesRaw || []) as VacancyRow[]

  const vacancies = vacanciesAll.filter((vacancy) => {
    const statusCode = vacancy.vacancy_statuses?.[0]?.code
    return statusCode === 'open' || statusCode === 'draft'
  })

  const [customFieldGroups, customFieldValues, { data: experienceRaw }, { data: educationRaw }] = await Promise.all([
    getCustomFieldSchema('candidate'),
    getCustomFieldValues(id),
    supabase.from('candidate_experience').select('*').eq('candidate_id', id).eq('organization_id', organizationId).order('start_date', { ascending: false, nullsFirst: false }),
    supabase.from('candidate_education').select('*').eq('candidate_id', id).eq('organization_id', organizationId).order('start_year', { ascending: false, nullsFirst: false }),
  ])

  const experienceEntries = (experienceRaw || []) as CandidateExperience[]
  const educationEntries  = (educationRaw  || []) as CandidateEducation[]

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
        extraSections={
          <>
            <ExperienceSection candidateId={id} initialEntries={experienceEntries} />
            <EducationSection candidateId={id} initialEntries={educationEntries} />
          </>
        }
      />
    </div>
  )
}
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '@/components/vacancies/vacancy-form'
import { Button } from '@/components/ui/button'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { getVacancyStatuses } from '@/lib/cache/lookups'

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
  responsibilities: string | null
  requirements: string | null
  show_on_public_page: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

interface SectorRow {
  id: string
  name: string
  code: string
  is_active: boolean
  sort_order: number
  created_at: string
}

interface VacancyStatusRow {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  is_active: boolean
  sort_order: number
}

export default async function EditVacancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ duplicated?: string }>
}) {
  const { id } = await params
  const { duplicated } = await searchParams
  const isDuplicated = duplicated === 'true'
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

  const [{ data: vacancyRaw }, { data: sectorsRaw }, statusOptionsRaw] =
    await Promise.all([
      supabase
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
          responsibilities,
          requirements,
          show_on_public_page,
          created_by,
          created_at,
          updated_at,
          archived_at
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .is('deleted_at', null)
        .single(),

      supabase
        .from('sectors')
        .select('id, name, code, is_active, sort_order, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      getVacancyStatuses(),
    ])

  const vacancy = vacancyRaw as VacancyRow | null
  const sectors = (sectorsRaw || []) as SectorRow[]
  const statusOptions = (statusOptionsRaw || []).filter((s) => s.is_active) as VacancyStatusRow[]

  if (!vacancy) {
    notFound()
  }

  const [customFieldGroups, customFieldValues] = await Promise.all([
    getCustomFieldSchema('vacancy'),
    getCustomFieldValues(id),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/vacancies/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isDuplicated ? 'New Vacancy (Duplicated)' : 'Edit Vacancy'}
          </h1>
          <p className="text-muted-foreground">
            {isDuplicated ? 'Review and save your duplicated vacancy.' : 'Update the job posting details.'}
          </p>
        </div>
      </div>

      <VacancyForm
        vacancy={vacancy}
        sectors={sectors}
        statusOptions={statusOptions}
        customFieldGroups={customFieldGroups}
        customFieldValues={customFieldValues}
        isDuplicated={isDuplicated}
      />
    </div>
  )
}
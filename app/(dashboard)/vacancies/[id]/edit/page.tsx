import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '@/components/vacancies/vacancy-form'
import { Button } from '@/components/ui/button'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'

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
}: {
  params: Promise<{ id: string }>
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

  const [{ data: vacancyRaw }, { data: sectorsRaw }, { data: statusOptionsRaw }] =
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
          requirements,
          created_by,
          created_at,
          updated_at,
          archived_at
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .single(),

      supabase
        .from('sectors')
        .select('id, name, code, is_active, sort_order, created_at')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),

      supabase
        .from('vacancy_statuses')
        .select('id, name, code, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])

  const vacancy = vacancyRaw as VacancyRow | null
  const sectors = (sectorsRaw || []) as SectorRow[]
  const statusOptions = (statusOptionsRaw || []) as VacancyStatusRow[]

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
          <h1 className="text-2xl font-bold text-foreground">Edit Vacancy</h1>
          <p className="text-muted-foreground">Update the job posting details.</p>
        </div>
      </div>

      <VacancyForm
        vacancy={vacancy}
        sectors={sectors}
        statusOptions={statusOptions}
        customFieldGroups={customFieldGroups}
        customFieldValues={customFieldValues}
      />
    </div>
  )
}
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '@/components/vacancies/vacancy-form'
import { Button } from '@/components/ui/button'
import { getCustomFieldSchema, getCustomFieldValues } from '@/lib/actions/custom-fields'
import { getVacancyStatuses } from '@/lib/cache/lookups'
import { orgDefaultLocale, orgEnabledLocales } from '@/lib/i18n/org-locale'
import { type LocalizedText } from '@/lib/i18n/locales'

interface VacancyRow {
  id: string
  organization_id: string
  title: string
  sector_id: string | null
  status_id: string | null
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  work_mode: 'remote' | 'hybrid' | 'onsite' | null
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
    redirect('/pipeline')
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
          work_mode,
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

  // i18n Slice 4 — org content languages + this vacancy's per-locale JD content.
  // Separate graceful reads (unmigrated → org falls back to English-only, and
  // the _i18n columns come back null → seeded from the legacy text).
  const { data: orgLangRow } = await supabase
    .from('organizations')
    .select('default_content_locale, enabled_content_locales')
    .eq('id', organizationId)
    .single()
  const orgLocales = { default: orgDefaultLocale(orgLangRow), enabled: orgEnabledLocales(orgLangRow) }

  const { data: vi18n } = await supabase
    .from('vacancies')
    .select('description_i18n, responsibilities_i18n, requirements_i18n')
    .eq('id', id)
    .single()
  const initialI18n = {
    description: (vi18n?.description_i18n as LocalizedText | null) ?? { [orgLocales.default]: vacancy.description },
    responsibilities: (vi18n?.responsibilities_i18n as LocalizedText | null) ?? {},
    requirements: (vi18n?.requirements_i18n as LocalizedText | null) ?? {},
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/vacancies/${id}`} aria-label="Back to vacancy">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isDuplicated ? 'New vacancy (duplicated)' : 'Edit vacancy'}
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
        orgLocales={orgLocales}
        initialI18n={initialI18n}
      />
    </div>
  )
}
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '@/components/vacancies/vacancy-form'
import { Button } from '@/components/ui/button'

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

export default async function NewVacancyPage() {
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

  const [{ data: sectorsRaw }, { data: statusOptionsRaw }] = await Promise.all([
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

  const sectors = (sectorsRaw || []) as SectorRow[]
  const statusOptions = (statusOptionsRaw || []) as VacancyStatusRow[]

  const defaultDraftStatus = statusOptions.find((status) => status.code === 'draft') || null

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vacancies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Vacancy</h1>
          <p className="text-muted-foreground">
            Add a new job posting to attract candidates.
          </p>
        </div>
      </div>

      <VacancyForm
        sectors={sectors}
        statusOptions={statusOptions}
      />
    </div>
  )
}
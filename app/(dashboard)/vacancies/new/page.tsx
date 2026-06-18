import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getVacancyStatuses } from '@/lib/cache/lookups'
import { VacancyCreateWizard } from '@/components/vacancies/wizard/vacancy-create-wizard'

/**
 * Wave 2.7 vacancy creation flow — replaced the single-page
 * VacancyForm with the stepped wizard per
 * `redesign/Create Vacancy Steps.dc.html`.
 *
 * Server component is now a thin host: fetches the sector + status
 * lookups and renders the client `<VacancyCreateWizard>`. All form
 * state lives in the wizard.
 */
interface VacancyStatusRow {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  is_active: boolean
  sort_order: number
}

export default async function NewVacancyPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const [{ data: sectorsRaw }, statusOptionsRaw] = await Promise.all([
    supabase
      .from('sectors')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    getVacancyStatuses(),
  ])

  const sectors = (sectorsRaw || []) as { id: string; name: string }[]
  const statusOptions = (statusOptionsRaw || []).filter((s) => s.is_active) as VacancyStatusRow[]

  return (
    <div className="mx-auto max-w-[1360px] p-4 lg:p-6">
      <VacancyCreateWizard sectors={sectors} statusOptions={statusOptions} />
    </div>
  )
}

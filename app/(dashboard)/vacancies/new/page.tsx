import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getVacancyStatuses } from '@/lib/cache/lookups'
import { VacancyCreateWizard } from '@/components/vacancies/wizard/vacancy-create-wizard'
import { orgDefaultLocale, orgEnabledLocales } from '@/lib/i18n/org-locale'
import { resolveOrgDefaultCurrency } from '@/lib/pricing/currency'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'

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

  if (!profile?.organization_id) redirect('/pipeline')

  const [{ data: sectorsRaw }, statusOptionsRaw, { data: orgLangRow }, { data: membersRaw }] = await Promise.all([
    supabase
      .from('sectors')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    getVacancyStatuses(),
    // Org content languages — when >1 is enabled the wizard shows per-language
    // JD tabs (i18n Slice 4). Graceful: a null row falls back to English-only.
    supabase
      .from('organizations')
      .select('default_content_locale, enabled_content_locales, billing_country, billing_currency')
      .eq('id', profile.organization_id)
      .maybeSingle(),
    // Org members — feed the hiring-manager picker (#9): UI shows the name,
    // stores the profile id as a real FK on vacancies.hiring_manager_id.
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', profile.organization_id)
      .order('full_name', { ascending: true }),
  ])

  const sectors = (sectorsRaw || []) as { id: string; name: string }[]
  const orgMembers = (membersRaw || []) as { id: string; full_name: string | null }[]
  const statusOptions = (statusOptionsRaw || []).filter((s) => s.is_active) as VacancyStatusRow[]
  const orgLocales = { default: orgDefaultLocale(orgLangRow), enabled: orgEnabledLocales(orgLangRow) }
  // Default the salary currency to the org's local/billing currency (GE→GEL,
  // EU→EUR, else USD). When billing isn't configured yet, fall back to the org's
  // content language so a Georgian-language org defaults to GEL, not USD (#10).
  const defaultCurrency = resolveOrgDefaultCurrency({
    billingCountry: (orgLangRow as { billing_country?: string | null } | null)?.billing_country ?? null,
    billingCurrency: (orgLangRow as { billing_currency?: string | null } | null)?.billing_currency ?? null,
    contentLocale: orgLocales.default,
  })

  // Vacancy custom fields — surfaced in the wizard (Step 2) so they can be
  // filled during creation, not only via Edit afterwards.
  const customFieldGroups = await getCustomFieldSchema('vacancy')

  return (
    <div className="mx-auto max-w-[1360px] p-4 lg:p-6">
      <VacancyCreateWizard sectors={sectors} statusOptions={statusOptions} orgLocales={orgLocales} defaultCurrency={defaultCurrency} orgMembers={orgMembers} customFieldGroups={customFieldGroups} />
    </div>
  )
}

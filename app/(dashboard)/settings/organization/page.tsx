import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrganizationForm } from '@/components/settings/organization-form'
import { DangerZone } from '@/components/settings/danger-zone'
import { MfaPolicyCard } from '@/components/settings/mfa-policy-card'
import { AiFitPolicyCard } from '@/components/settings/ai-fit-policy-card'
import { OrgLanguageCard } from '@/components/settings/org-language-card'
import { orgDefaultLocale, orgEnabledLocales } from '@/lib/i18n/org-locale'

export default async function OrganizationSettingsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner') redirect('/settings/profile')
  if (!profile.organization_id) redirect('/settings/profile')

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, public_page_slug, logo_url, is_active, created_at, updated_at, require_mfa, require_mfa_for_admins')
    .eq('id', profile.organization_id)
    .single()

  if (!organization) redirect('/settings/profile')

  // Separate, graceful read so an unmigrated ai_fit_* column can never break the
  // whole settings page (the column ships in migration 20260722_ai_fit_analysis).
  const { data: aiFit } = await supabase
    .from('organizations')
    .select('ai_fit_enabled')
    .eq('id', organization.id)
    .single()

  // Same graceful pattern for the content-language columns (migration
  // 20260802_org_content_locale) — unmigrated → falls back to English-only.
  const { data: orgLang } = await supabase
    .from('organizations')
    .select('default_content_locale, enabled_content_locales')
    .eq('id', organization.id)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('settings.org.title')}</CardTitle>
          <CardDescription>{t('settings.org.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm organization={organization} />
        </CardContent>
      </Card>

      <MfaPolicyCard
        initial={{
          require_mfa: !!organization.require_mfa,
          require_mfa_for_admins: !!organization.require_mfa_for_admins,
        }}
      />

      <OrgLanguageCard
        initial={{
          default: orgDefaultLocale(orgLang),
          enabled: orgEnabledLocales(orgLang),
        }}
      />

      <AiFitPolicyCard initial={{ ai_fit_enabled: !!aiFit?.ai_fit_enabled }} />

      <DangerZone organizationName={organization.name} />
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveOrgContentLocale } from '@/lib/i18n/org-locale'
import { pickLocale, LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

export const revalidate = 300 // 5 minutes

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

/** As-needed locale prefix: English is canonical (no prefix). */
function jobsPath(locale: Locale, slug: string): string {
  return locale === DEFAULT_LOCALE ? `/jobs/${slug}` : `/${locale}/jobs/${slug}`
}

async function resolveOrg(slug: string) {
  const supabase = createAdminClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, public_page_slug, default_content_locale, enabled_content_locales')
    .eq('public_page_slug', slug)
    .single()
  return org
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const org = await resolveOrg(slug)
  if (!org) return { title: 'Jobs' }
  return {
    title: `Open positions — ${org.name}`,
    description: `Browse open positions at ${org.name} and apply online.`,
    // hreflang alternates so Google indexes each language variant.
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, jobsPath(l, slug)])),
    },
  }
}

const employmentLabelKey: Record<string, string> = {
  full_time: 'enum.employment.fullTime',
  part_time: 'enum.employment.partTime',
  contract: 'enum.employment.contract',
  internship: 'enum.employment.internship',
}

export default async function PublicJobsPage({ params }: PageProps) {
  const { locale, slug } = await params
  const supabase = createAdminClient()

  const org = await resolveOrg(slug)
  if (!org) notFound()

  // Display locale = the URL locale IF the org enabled it, else the org default.
  const displayLocale = resolveOrgContentLocale(org, locale)
  const t = await getTranslations({ locale: displayLocale })

  const { data: vacanciesRaw } = await supabase
    .from('vacancies')
    .select(`
      id,
      title,
      department,
      location,
      employment_type,
      description,
      description_i18n,
      application_form_token,
      vacancy_statuses ( code )
    `)
    .eq('organization_id', org.id)
    .eq('show_on_public_page', true)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  type StatusJoin = { code: string } | { code: string }[] | null
  const vacancies = (vacanciesRaw || []).filter((v) => {
    const statusJoin = v.vacancy_statuses as StatusJoin
    const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
    return statusCode === 'open' && v.application_form_token
  })

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="h-2 bg-primary" aria-hidden />
          <div className="p-8 text-center">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="mx-auto mb-4 h-14 w-14 rounded-lg object-contain border border-gray-100"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)] text-xl font-bold text-[oklch(0.42_0.16_250)]">
                {org.name[0]}
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('jobs.openPositions')} · {t('jobs.rolesCount', { count: vacancies.length })}
            </p>
          </div>
        </div>

        {vacancies.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <p className="text-gray-500">{t('jobs.noPositions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vacancies.map((v) => {
              const previewText = pickLocale(v.description_i18n ?? v.description, displayLocale)
              return (
                <Link
                  key={v.id}
                  href={`/apply/${v.application_form_token}`}
                  className="block rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-gray-900">{v.title}</h2>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-500">
                        {v.department && <span>{v.department}</span>}
                        {v.location && <span>· {v.location}</span>}
                        {v.employment_type && (
                          <span>· {employmentLabelKey[v.employment_type] ? t(employmentLabelKey[v.employment_type]!) : v.employment_type}</span>
                        )}
                      </div>
                      {previewText && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{previewText}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-medium text-primary">{t('jobs.apply')} →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">{t('jobs.poweredBy')}</p>
      </div>
    </div>
  )
}

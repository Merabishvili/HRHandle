import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApplyForm } from '@/components/apply/apply-form'
import { JobDescriptionBlock } from '@/components/apply/job-description-block'
import { resolveOrgContentLocale } from '@/lib/i18n/org-locale'
import { pickLocale } from '@/lib/i18n/locales'

export const revalidate = 300 // 5 minutes

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: vacancy } = await supabase
    .from('vacancies')
    .select('title, organizations(name)')
    .eq('application_form_token', token)
    .is('deleted_at', null)
    .single()

  if (!vacancy) return { title: 'Position not found' }

  type MetaOrgJoin = { name: string } | { name: string }[] | null
  const metaOrg = vacancy.organizations as MetaOrgJoin
  const orgName = (Array.isArray(metaOrg) ? metaOrg[0]?.name : metaOrg?.name) || 'Company'
  return {
    title: `${vacancy.title} — ${orgName}`,
    description: `Apply for ${vacancy.title} at ${orgName}`,
  }
}

export default async function ApplyPage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: vacancy } = await supabase
    .from('vacancies')
    .select(`
      id,
      title,
      department,
      location,
      employment_type,
      description,
      responsibilities,
      requirements,
      archived_at,
      application_form_token,
      vacancy_statuses ( code ),
      organizations ( id, name, logo_url, public_page_slug )
    `)
    .eq('application_form_token', token)
    .is('deleted_at', null)
    .single()

  if (!vacancy) notFound()

  // Supabase may return the joined row as object or single-element array — handle both
  type StatusJoin = { code: string } | { code: string }[] | null
  type OrgRow = { id: string; name: string; logo_url: string | null; public_page_slug: string | null }
  type OrgJoin = OrgRow | OrgRow[] | null
  const statusJoin = vacancy.vacancy_statuses as StatusJoin
  const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
  const isClosed = vacancy.archived_at || statusCode !== 'open'

  // Wave 2.5 Slice 2b — fetch the vacancy's screening questions so the
  // form can render them. Token in the URL is the credential; we use the
  // admin client (same pattern as the vacancy lookup above) to bypass
  // RLS on the unauthenticated apply page.
  const { data: screeningQuestionsRaw } = await supabase
    .from('vacancy_screening_questions')
    .select('id, label, answer_type, is_knockout, knockout_answer, options, sort_order')
    .eq('vacancy_id', vacancy.id)
    .order('sort_order', { ascending: true })

  const screeningQuestions = (screeningQuestionsRaw || []) as {
    id: string
    label: string
    answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
    is_knockout: boolean
    knockout_answer: string | null
    options: string[] | null
    sort_order: number
  }[]

  const orgJoin = vacancy.organizations as OrgJoin
  const org = (Array.isArray(orgJoin) ? orgJoin[0] : orgJoin) || null
  const publicJobsSlug = org?.public_page_slug as string | null

  // Wave 3.1 — GDPR Art. 22 / EU AI Act transparency: if this org uses AI Fit
  // Analysis, disclose it to applicants. Separate, graceful query so the
  // unmigrated column can never take down the public apply page.
  let aiFitEnabled = false
  if (org?.id) {
    const { data: aiOrg } = await supabase
      .from('organizations')
      .select('ai_fit_enabled')
      .eq('id', org.id)
      .single()
    aiFitEnabled = !!aiOrg?.ai_fit_enabled
  }

  // i18n Slice 3b — render the candidate page in the ORG's content language
  // (graceful: unmigrated / unset → English). The client form is wrapped in a
  // nested provider with this locale so it doesn't inherit the visitor cookie.
  const { data: orgLang } = org?.id
    ? await supabase
        .from('organizations')
        .select('default_content_locale, enabled_content_locales')
        .eq('id', org.id)
        .single()
    : { data: null }
  const contentLocale = resolveOrgContentLocale(orgLang)
  const t = await getTranslations({ locale: contentLocale })
  const messages = await getMessages({ locale: contentLocale })

  // i18n Slice 4 — per-locale JD content (graceful separate read; unmigrated /
  // no translation → falls back to the legacy single-language columns).
  const { data: vi18n } = await supabase
    .from('vacancies')
    .select('description_i18n, responsibilities_i18n, requirements_i18n')
    .eq('id', vacancy.id)
    .single()
  const descriptionText = pickLocale(vi18n?.description_i18n ?? vacancy.description, contentLocale)
  const responsibilitiesText = pickLocale(vi18n?.responsibilities_i18n ?? vacancy.responsibilities, contentLocale)
  const requirementsText = pickLocale(vi18n?.requirements_i18n ?? vacancy.requirements, contentLocale)

  const employmentLabelKey: Record<string, string> = {
    full_time: 'enum.employment.fullTime',
    part_time: 'enum.employment.partTime',
    contract: 'enum.employment.contract',
    internship: 'enum.employment.internship',
  }

  const jobPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: vacancy.title,
    description: [vacancy.description, vacancy.requirements].filter(Boolean).join('\n\n') || undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: org?.name,
      ...(org?.logo_url ? { logo: org.logo_url } : {}),
    },
    jobLocation: vacancy.location
      ? { '@type': 'Place', address: vacancy.location }
      : undefined,
    employmentType: vacancy.employment_type?.toUpperCase().replace('_', '-') || undefined,
    department: vacancy.department || undefined,
    directApply: true,
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Back to all vacancies */}
        {publicJobsSlug && (
          <a
            href={`/jobs/${publicJobsSlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            {t('apply.allOpenPositions')}
          </a>
        )}

        {/* Header — 8px brand-blue bar at top matches /jobs per
            Public Pages.dc.html §2 ("thin brand bar"). */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="h-2 bg-primary" aria-hidden />
          <div className="p-8">
          <div className="mb-6 flex items-start gap-4">
            {org?.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-12 w-12 rounded-lg object-contain border border-gray-100"
              />
            ) : (
              // Pale brand-blue tint per Public Pages.dc.html — job header
              // card on the apply page. Tier 1 of fidelity-audit.md.
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)] text-lg font-bold text-[oklch(0.42_0.16_250)]">
                {org?.name?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500">{org?.name || t('apply.company')}</p>
              <h1 className="text-2xl font-bold text-gray-900">{vacancy.title}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
                {vacancy.location && <span>{vacancy.location}</span>}
                {vacancy.department && <span>· {vacancy.department}</span>}
                {vacancy.employment_type && (
                  <span>· {employmentLabelKey[vacancy.employment_type] ? t(employmentLabelKey[vacancy.employment_type]!) : vacancy.employment_type}</span>
                )}
              </div>
            </div>
          </div>

          {descriptionText && (
            <div className="mb-4">
              <JobDescriptionBlock title={t('apply.aboutJob')} body={descriptionText} />
            </div>
          )}

          {responsibilitiesText && (
            <div className="mb-4">
              <JobDescriptionBlock title={t('apply.responsibilities')} body={responsibilitiesText} />
            </div>
          )}

          {requirementsText && (
            <JobDescriptionBlock title={t('apply.requirements')} body={requirementsText} />
          )}
          </div>
        </div>

        {/* Application Form */}
        {isClosed ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <p className="text-lg font-semibold text-gray-700">{t('apply.closedTitle')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('apply.closedBody')}</p>
          </div>
        ) : (
          <NextIntlClientProvider locale={contentLocale} messages={messages}>
            <ApplyForm
              token={token}
              companyName={org?.name || t('apply.company')}
              screeningQuestions={screeningQuestions}
            />
          </NextIntlClientProvider>
        )}

        {/* AI transparency notice (Wave 3.1) — only when this org uses AI Fit. */}
        {aiFitEnabled && !isClosed && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
            <p className="mb-1 flex items-center gap-2 font-semibold text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3a6 6 0 0 0-6 6c0 1.6.8 3 2 4l.5 3h7l.5-3c1.2-1 2-2.4 2-4a6 6 0 0 0-6-6Z"/><path d="M9 18h6"/><path d="M10 21h4"/></svg>
              {t('apply.aiReviewTitle')}
            </p>
            <p>{t('apply.aiReviewBody', { company: org?.name || t('apply.company') })}</p>
          </div>
        )}

        {publicJobsSlug && (
          <div className="text-center">
            <a
              href={`/jobs/${publicJobsSlug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
              {t('apply.viewAllAt', { company: org?.name || t('apply.company') })}
            </a>
          </div>
        )}
        <p className="text-center text-xs text-gray-400">{t('jobs.poweredBy')}</p>
      </div>
    </div>
  )
}

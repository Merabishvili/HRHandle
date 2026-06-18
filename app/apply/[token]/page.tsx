import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApplyForm } from '@/components/apply/apply-form'

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
      organizations ( name, logo_url, public_page_slug )
    `)
    .eq('application_form_token', token)
    .is('deleted_at', null)
    .single()

  if (!vacancy) notFound()

  // Supabase may return the joined row as object or single-element array — handle both
  type StatusJoin = { code: string } | { code: string }[] | null
  type OrgJoin = { name: string; logo_url: string | null; public_page_slug: string | null } | { name: string; logo_url: string | null; public_page_slug: string | null }[] | null
  const statusJoin = vacancy.vacancy_statuses as StatusJoin
  const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
  const isClosed = vacancy.archived_at || statusCode !== 'open'

  const orgJoin = vacancy.organizations as OrgJoin
  const org = (Array.isArray(orgJoin) ? orgJoin[0] : orgJoin) || null
  const publicJobsSlug = org?.public_page_slug as string | null

  const employmentLabel: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
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
            All open positions
          </a>
        )}

        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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
              <p className="text-sm font-medium text-gray-500">{org?.name || 'Company'}</p>
              <h1 className="text-2xl font-bold text-gray-900">{vacancy.title}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
                {vacancy.location && <span>{vacancy.location}</span>}
                {vacancy.department && <span>· {vacancy.department}</span>}
                {vacancy.employment_type && (
                  <span>· {employmentLabel[vacancy.employment_type] || vacancy.employment_type}</span>
                )}
              </div>
            </div>
          </div>

          {vacancy.description && (
            <div className="mb-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">About the job</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{vacancy.description}</div>
            </div>
          )}

          {vacancy.responsibilities && (
            <div className="mb-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Responsibilities</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{vacancy.responsibilities}</div>
            </div>
          )}

          {vacancy.requirements && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Requirements</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{vacancy.requirements}</div>
            </div>
          )}
        </div>

        {/* Application Form */}
        {isClosed ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <p className="text-lg font-semibold text-gray-700">This position is no longer open.</p>
            <p className="mt-1 text-sm text-gray-500">The role may have been filled or closed. Thank you for your interest.</p>
          </div>
        ) : (
          <ApplyForm token={token} companyName={org?.name || 'this company'} />
        )}

        {publicJobsSlug && (
          <div className="text-center">
            <a
              href={`/jobs/${publicJobsSlug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
              View all open positions at {org?.name || 'this company'}
            </a>
          </div>
        )}
        <p className="text-center text-xs text-gray-400">Powered by HRHandle</p>
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300 // 5 minutes

interface PageProps {
  params: Promise<{ slug: string }>
}

async function resolveOrg(slug: string) {
  const supabase = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, public_page_slug')
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
  }
}

const employmentLabel: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

export default async function PublicJobsPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createAdminClient()

  const org = await resolveOrg(slug)
  if (!org) notFound()

  const { data: vacanciesRaw } = await supabase
    .from('vacancies')
    .select(`
      id,
      title,
      department,
      location,
      employment_type,
      description,
      application_form_token,
      vacancy_statuses ( code )
    `)
    .eq('organization_id', org.id)
    .eq('show_on_public_page', true)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Only show open vacancies with a form token.
  // Supabase may return the joined row as an object or a single-element array
  // depending on relationship configuration — handle both.
  type StatusJoin = { code: string } | { code: string }[] | null
  const vacancies = (vacanciesRaw || []).filter((v) => {
    const statusJoin = v.vacancy_statuses as StatusJoin
    const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
    return statusCode === 'open' && v.application_form_token
  })

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header — 8px brand-blue bar at top, then logo / org name / role count
            (Wave 3.2 spec — visual addition only, no logic change) */}
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
              // Pale brand-blue tint per Public Pages.dc.html — the org's
              // careers page should read as their company's surface, not a
              // generic gray placeholder. Tier 1 of fidelity-audit.md.
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)] text-xl font-bold text-[oklch(0.42_0.16_250)]">
                {org.name[0]}
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Open positions · {vacancies.length} {vacancies.length === 1 ? 'role' : 'roles'}
            </p>
          </div>
        </div>

        {/* Vacancy list */}
        {vacancies.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <p className="text-gray-500">No open positions right now. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vacancies.map((v) => (
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
                        <span>· {employmentLabel[v.employment_type] || v.employment_type}</span>
                      )}
                    </div>
                    {v.description && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{v.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-medium text-primary">Apply →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Powered by HRHandle</p>
      </div>
    </div>
  )
}

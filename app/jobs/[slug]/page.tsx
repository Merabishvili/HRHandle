import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function resolveOrg(slug: string) {
  const supabase = createAdminClient()

  // 1. Try public_page_slug (clean human-readable slug)
  let { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, public_page_slug')
    .eq('public_page_slug', slug)
    .single()

  // 2. Fallback: internal app slug
  if (!org) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, logo_url, public_page_slug')
      .eq('slug', slug)
      .single()
    org = data
  }

  // 3. Fallback: UUID public_page_token (backward compat with old links)
  if (!org) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, logo_url, public_page_slug')
      .eq('public_page_token', slug)
      .single()
    org = data
  }

  return org
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const org = await resolveOrg(slug)
  if (!org) return { title: 'Jobs' }
  return {
    title: `Open Positions — ${org.name}`,
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
  const vacancies = (vacanciesRaw || []).filter((v) => {
    const statusJoin = v.vacancy_statuses as any
    const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
    return statusCode === 'open' && v.application_form_token
  })

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              className="mx-auto mb-4 h-14 w-14 rounded-lg object-contain border border-gray-100"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 text-xl font-bold text-gray-500">
              {org.name[0]}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <p className="mt-1 text-sm text-gray-500">Open Positions</p>
        </div>

        {/* Vacancy list */}
        {vacancies.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <p className="text-gray-500">No open positions at the moment. Check back soon.</p>
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
                  <span className="shrink-0 text-sm font-medium text-blue-600">Apply →</span>
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

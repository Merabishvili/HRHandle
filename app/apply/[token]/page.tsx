import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApplyForm } from '@/components/apply/apply-form'

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
    .single()

  if (!vacancy) return { title: 'Position Not Found' }

  const orgName = (vacancy.organizations as any)?.[0]?.name || 'Company'
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
      requirements,
      archived_at,
      application_form_token,
      vacancy_statuses ( code ),
      organizations ( name, logo_url )
    `)
    .eq('application_form_token', token)
    .single()

  if (!vacancy) notFound()

  const statusCode = (vacancy.vacancy_statuses as any)?.[0]?.code
  const isClosed =
    vacancy.archived_at ||
    statusCode === 'closed' ||
    statusCode === 'archived'

  const org = (vacancy.organizations as any)?.[0] || null

  const employmentLabel: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">

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
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-lg font-bold text-gray-500">
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
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">About the Job</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{vacancy.description}</div>
            </div>
          )}

          {(vacancy as any).responsibilities && (
            <div className="mb-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Responsibilities</h2>
              <div className="whitespace-pre-wrap text-sm text-gray-700">{(vacancy as any).responsibilities}</div>
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
          <ApplyForm token={token} />
        )}

        <p className="text-center text-xs text-gray-400">Powered by HRHandle</p>
      </div>
    </div>
  )
}

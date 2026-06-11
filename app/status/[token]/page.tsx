import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Building2, Briefcase, MapPin, Calendar } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'
import { statusCodeToBucket } from '@/lib/application-status-bucket'
import { StatusStepper } from '@/components/status/status-stepper'
import type { ApplicationStatus } from '@/lib/types/application'

interface PageProps {
  params: Promise<{ token: string }>
}

// Public status page (G-016) — token-gated, no login. Lookup uses the admin
// client to bypass RLS; the URL itself is the credential, same risk model as
// `application_form_token`. We return 404 (not "deleted") so the page can't be
// used as an oracle to confirm whether a particular application ever existed.
export const revalidate = 0
export const dynamic = 'force-dynamic'

interface VacancyJoin {
  title: string
  department: string | null
  location: string | null
  deleted_at: string | null
}

interface OrgJoin {
  name: string
  deleted_at: string | null
}

interface CandidateJoin {
  first_name: string
  deleted_at: string | null
}

interface StatusJoin {
  code: ApplicationStatus['code']
}

interface ApplicationRow {
  id: string
  applied_at: string
  last_status_changed_at: string | null
  deleted_at: string | null
  vacancies: VacancyJoin | VacancyJoin[] | null
  organizations: OrgJoin | OrgJoin[] | null
  candidates: CandidateJoin | CandidateJoin[] | null
  application_statuses: StatusJoin | StatusJoin[] | null
}

function unwrap<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

export default async function StatusPage({ params }: PageProps) {
  const { token } = await params

  // Cheap defense — UUID-hex tokens are always 32 chars. Reject obviously
  // malformed inputs before we hit the database. The actual auth is the
  // unique-token lookup below.
  if (!token || token.length < 16 || token.length > 64 || !/^[a-f0-9]+$/i.test(token)) {
    notFound()
  }

  const supabase = createAdminClient()
  const { data: app, error } = await supabase
    .from('applications')
    .select(
      `id, applied_at, last_status_changed_at, deleted_at,
       vacancies ( title, department, location, deleted_at ),
       organizations ( name, deleted_at ),
       candidates ( first_name, deleted_at ),
       application_statuses ( code )`,
    )
    .eq('public_token', token)
    .maybeSingle<ApplicationRow>()

  if (error) {
    console.error('[status] application fetch failed:', error.message)
    notFound()
  }
  if (!app || app.deleted_at) notFound()

  const vacancy = unwrap(app.vacancies)
  const org = unwrap(app.organizations)
  const candidate = unwrap(app.candidates)
  const statusRow = unwrap(app.application_statuses)

  // If any of the parent rows are soft-deleted (org tearing down, vacancy
  // archived to deleted_at, candidate self-deletion path) we hide the status
  // page. Same 404 reply so the URL can't be used as a side channel.
  if (
    !vacancy ||
    vacancy.deleted_at ||
    !org ||
    org.deleted_at ||
    !candidate ||
    candidate.deleted_at
  ) {
    notFound()
  }

  const view = statusCodeToBucket(statusRow?.code ?? null)
  const showStepper = view.bucket !== 'closed'
  const decisionComplete = view.outcome === 'hired'

  const appliedAt = format(new Date(app.applied_at), 'MMM d, yyyy')
  const lastUpdatedAt = app.last_status_changed_at
    ? format(new Date(app.last_status_changed_at), 'MMM d, yyyy')
    : appliedAt

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Application status
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          Hi {candidate.first_name}, here&apos;s where things stand
        </h1>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <dl className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <div>
              <dt className="sr-only">Role</dt>
              <dd className="font-semibold text-gray-900">{vacancy.title}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <div>
              <dt className="sr-only">Employer</dt>
              <dd className="text-gray-700">{org.name}</dd>
            </div>
          </div>
          {(vacancy.department || vacancy.location) && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <div>
                <dt className="sr-only">Where</dt>
                <dd className="text-gray-700">
                  {[vacancy.department, vacancy.location].filter(Boolean).join(' · ')}
                </dd>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <div>
              <dt className="sr-only">Applied</dt>
              <dd className="text-gray-700">Applied {appliedAt}</dd>
            </div>
          </div>
        </dl>

        <hr className="my-6 border-gray-200" />

        {showStepper && (
          <div className="mb-6">
            <StatusStepper
              currentBucket={view.bucket}
              decisionComplete={decisionComplete}
            />
          </div>
        )}

        <div
          className={[
            'rounded-xl p-4',
            view.bucket === 'closed'
              ? 'bg-gray-100'
              : decisionComplete
                ? 'bg-emerald-50'
                : 'bg-indigo-50',
          ].join(' ')}
        >
          <p className="text-sm font-semibold text-gray-900">{view.label}</p>
          <p className="mt-1 text-sm text-gray-700">{view.subtitle}</p>
          <p className="mt-3 text-xs text-gray-500">Last updated {lastUpdatedAt}</p>
        </div>
      </section>

      <footer className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          This page only shows your own application status. Bookmark this link to check back —
          the recruiter will contact you directly with any next steps.
        </p>
      </footer>
    </main>
  )
}

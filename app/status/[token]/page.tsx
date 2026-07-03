import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Building2, Briefcase, MapPin, Calendar, FileText } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'
import { statusCodeToBucket } from '@/lib/application-status-bucket'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { isOfferExpired } from '@/lib/offers/expiry'
import { StatusStepper } from '@/components/status/status-stepper'
import { WithdrawButton } from '@/components/status/withdraw-button'

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

interface StageJoin {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
}

interface ApplicationRow {
  id: string
  applied_at: string
  last_status_changed_at: string | null
  deleted_at: string | null
  vacancies: VacancyJoin | VacancyJoin[] | null
  organizations: OrgJoin | OrgJoin[] | null
  candidates: CandidateJoin | CandidateJoin[] | null
  pipeline_stages: StageJoin | StageJoin[] | null
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
       pipeline_stages ( type, name, is_terminal )`,
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
  const stageRow = unwrap(app.pipeline_stages)

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

  const view = statusCodeToBucket(stageRow ? mapPipelineStageToBucket(stageRow) : null)
  const showStepper = view.bucket !== 'closed'
  const decisionComplete = view.outcome === 'hired'

  // S05 §2.3 — surface a pending offer at the top of the status tile.
  // Reads offers where status='sent' (signed and delivered, awaiting candidate
  // response). Drop any whose expiry_date has already passed so we don't
  // route the candidate to a /offer page they can no longer act on.
  const { data: offersRaw } = await supabase
    .from('offers')
    .select('public_token, expiry_date, sent_at')
    .eq('application_id', app.id)
    .eq('status', 'sent')
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)

  // isOfferExpired does YMD-level comparison rather than Date arithmetic
  // so the boundary ("expires 2026-06-30 → still valid up to 2026-07-01")
  // matches what we tell candidates in the email, regardless of timezone.
  const pendingOffer = (() => {
    const row = offersRaw?.[0]
    if (!row || !row.public_token) return null
    if (isOfferExpired(row.expiry_date)) return null
    return row as { public_token: string; expiry_date: string | null; sent_at: string | null }
  })()

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

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-2 bg-blue-600" aria-hidden />
        <div className="p-6 sm:p-8">
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

        {pendingOffer && (
          <Link
            href={`/offer/${pendingOffer.public_token}`}
            className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">You have an offer to review</p>
                {pendingOffer.expiry_date && (
                  <p className="mt-0.5 text-xs text-emerald-800">
                    Respond by {format(new Date(pendingOffer.expiry_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
            <span className="text-sm font-medium text-emerald-700" aria-hidden>
              View offer →
            </span>
          </Link>
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

        {/* G-022: candidate-side withdraw. Only shown for non-terminal buckets;
            terminal states (Closed, decision-complete hire) already render the
            outcome above and shouldn't be overridable from the candidate side. */}
        {!view.isTerminal && view.bucket !== 'closed' && (
          <WithdrawButton
            token={token}
            roleTitle={vacancy.title}
            organizationName={org.name}
          />
        )}
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

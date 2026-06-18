import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Building2, Briefcase, Calendar, Clock } from 'lucide-react'

import { getOfferByToken } from '@/lib/actions/offers'
import { COMPENSATION_PERIOD_LABELS, type CompensationPeriod } from '@/lib/offers/state'
import { offerCountdown } from '@/lib/offers/expiry'
import { OfferRespondForm } from '@/components/offers/offer-respond-form'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public, token-gated offer page (G-018, phase 2). Mirrors the G-016 status
// page's risk model: the URL itself is the credential, looked up via the
// admin client. We return notFound() rather than "deleted" for missing,
// soft-deleted, or wrong-token cases so the URL can't be used to confirm
// whether a particular offer existed.
export default async function OfferPage({ params }: PageProps) {
  const { token } = await params
  const result = await getOfferByToken(token)
  if (!result.success) notFound()

  const offer = result.data
  const isRespondable = offer.status === 'sent'
  const responded = offer.status === 'accepted' || offer.status === 'declined'

  const showCompensation =
    offer.compensation_amount !== null && offer.compensation_amount !== undefined

  const compensationLine = showCompensation
    ? formatCompensation(
        offer.compensation_amount as number,
        offer.compensation_currency,
        (offer.compensation_period ?? null) as CompensationPeriod | null,
      )
    : null

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Offer from {offer.organization_name}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          Hi {offer.candidate_first_name}, here&apos;s your offer
        </h1>
      </header>

      <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Summary tile */}
        <dl className="space-y-3 text-sm">
          <Row icon={Briefcase} label="Role">
            <span className="font-semibold text-gray-900">{offer.role_title}</span>
          </Row>
          <Row icon={Building2} label="Employer">
            <span className="text-gray-700">{offer.organization_name}</span>
          </Row>
          {compensationLine && (
            <Row icon={Briefcase} label="Compensation">
              <span className="text-gray-900">{compensationLine}</span>
            </Row>
          )}
          {offer.start_date && (
            <Row icon={Calendar} label="Start date">
              <span className="text-gray-700">
                {format(new Date(offer.start_date), 'MMMM d, yyyy')}
              </span>
            </Row>
          )}
          {offer.expiry_date && isRespondable && (
            <Row icon={Clock} label="Respond by">
              <span className="text-gray-700">
                {format(new Date(offer.expiry_date), 'MMMM d, yyyy')}
              </span>
              {(() => {
                const countdown = offerCountdown(offer.expiry_date)
                if (!countdown) return null
                return (
                  <span
                    className={cn(
                      'ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium',
                      countdown.urgency === 'urgent' && 'bg-red-50 text-red-700',
                      countdown.urgency === 'soon' && 'bg-amber-50 text-amber-800',
                      countdown.urgency === 'normal' && 'bg-gray-100 text-gray-700',
                    )}
                    aria-label={`${countdown.label} to respond`}
                  >
                    {countdown.label}
                  </span>
                )
              })()}
            </Row>
          )}
        </dl>

        <hr className="border-gray-200" />

        {/* Body — plain text with preserved line breaks; no markdown for v1. */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Offer details
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {offer.body}
          </p>
        </div>

        {offer.recruiter_message && (
          <>
            <hr className="border-gray-200" />
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                A note from the recruiter
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {offer.recruiter_message}
              </p>
            </div>
          </>
        )}

        <hr className="border-gray-200" />

        {/* Status + action area */}
        <StatusArea status={offer.status} token={token} />
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs text-gray-500">
        {!responded && offer.sent_at && (
          <p>Sent {format(new Date(offer.sent_at), 'MMMM d, yyyy')}.</p>
        )}
        <p>
          Keep this link private — it&apos;s the only way to view or respond to this
          offer.
        </p>
      </footer>
    </main>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      <div className="flex-1">
        <dt className="sr-only">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  )
}

function StatusArea({ status, token }: { status: string; token: string }) {
  if (status === 'sent') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          When you&apos;re ready, accept or decline below. You&apos;ll see a confirmation
          straight away.
        </p>
        <OfferRespondForm token={token} />
      </div>
    )
  }
  if (status === 'accepted') {
    return (
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">You accepted this offer.</p>
        <p className="mt-1 text-sm text-emerald-800">
          The recruiter has been notified and will be in touch with the next steps.
        </p>
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900">You declined this offer.</p>
        <p className="mt-1 text-sm text-gray-700">
          Thank you for letting the team know. The recruiter has been notified.
        </p>
      </div>
    )
  }
  if (status === 'expired') {
    return (
      <div className="rounded-xl bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">This offer has expired.</p>
        <p className="mt-1 text-sm text-amber-800">
          If you&apos;d still like to discuss, please contact the recruiter directly.
        </p>
      </div>
    )
  }
  if (status === 'withdrawn') {
    return (
      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900">This offer has been withdrawn.</p>
        <p className="mt-1 text-sm text-gray-700">
          The recruiter has retracted this offer. Contact them if you have questions.
        </p>
      </div>
    )
  }
  // 'draft' shouldn't be reachable (no public_token on drafts) but be defensive.
  return null
}

function formatCompensation(
  amount: number,
  currency: string | null,
  period: CompensationPeriod | null,
): string {
  // Try Intl with the recruiter-supplied currency; fall back to a plain
  // numeric format if Intl rejects the code (it does for non-ISO strings).
  let formatted = String(amount)
  if (currency) {
    try {
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      formatted = `${amount.toLocaleString('en-US')} ${currency}`
    }
  } else {
    formatted = amount.toLocaleString('en-US')
  }
  const periodLabel = period ? COMPENSATION_PERIOD_LABELS[period] : ''
  return periodLabel ? `${formatted} ${periodLabel}` : formatted
}

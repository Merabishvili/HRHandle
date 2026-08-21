import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import type { Locale as DateFnsLocale } from 'date-fns'
import { Building2, Briefcase, Calendar, Clock } from 'lucide-react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'

import { getOfferByToken } from '@/lib/actions/offers'
import { type CompensationPeriod } from '@/lib/offers/state'
import { offerCountdown } from '@/lib/offers/expiry'
import { OfferRespondForm } from '@/components/offers/offer-respond-form'
import { OfferBody } from '@/components/offers/offer-body'
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { dateFnsLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'

type Translator = Awaited<ReturnType<typeof getTranslations>>

/** BCP-47 tag for Intl number/currency formatting, per app content locale. */
const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', ka: 'ka-GE', ru: 'ru-RU' }

const COMPENSATION_PERIOD_KEY: Partial<Record<CompensationPeriod, string>> = {
  annual: 'offer.perYear',
  monthly: 'offer.perMonth',
  hourly: 'offer.perHour',
}

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

  // Render in the org's single content language (resolved in the action).
  const contentLocale = isLocale(offer.content_locale) ? offer.content_locale : DEFAULT_LOCALE
  const t = await getTranslations({ locale: contentLocale })
  const messages = await getMessages({ locale: contentLocale })
  const dfLocale = dateFnsLocale(contentLocale)
  const intlLocale = INTL_LOCALE[contentLocale]
  const companyName = offer.organization_name?.trim() || t('offer.hiringTeam')

  const showCompensation =
    offer.compensation_amount !== null && offer.compensation_amount !== undefined

  const periodKey = offer.compensation_period
    ? COMPENSATION_PERIOD_KEY[offer.compensation_period as CompensationPeriod]
    : undefined
  const periodLabel = periodKey ? t(periodKey) : ''
  const compensationLine = showCompensation
    ? formatCompensation(offer.compensation_amount as number, offer.compensation_currency, periodLabel, intlLocale)
    : null

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {t('offer.eyebrow', { company: companyName })}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          {t('offer.greeting', { name: offer.candidate_first_name })}
        </h1>
      </header>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* 6px brand-blue bar at the top of the offer card per
            Public Offer.dc.html — light brand polish on the candidate's
            decision moment. Tier 2 of fidelity-audit.md. */}
        <div className="h-1.5 bg-[oklch(0.55_0.18_250)]" aria-hidden />

        <div className="space-y-6 p-6 sm:p-8">
        {/* Summary tile */}
        <dl className="space-y-3 text-sm">
          <Row icon={Briefcase} label={t('offer.role')}>
            <span className="font-semibold text-gray-900">{offer.role_title}</span>
          </Row>
          <Row icon={Building2} label={t('offer.employer')}>
            <span className="text-gray-700">{companyName}</span>
          </Row>
          {compensationLine && (
            <Row icon={Briefcase} label={t('offer.compensation')}>
              <span className="text-gray-900">{compensationLine}</span>
            </Row>
          )}
          {offer.start_date && (
            <Row icon={Calendar} label={t('offer.startDate')}>
              <span className="text-gray-700">
                {format(new Date(offer.start_date), 'd MMMM yyyy', { locale: dfLocale })}
              </span>
            </Row>
          )}
          {offer.expiry_date && isRespondable && (() => {
            const countdown = offerCountdown(offer.expiry_date)
            // Per Public Offer.dc.html — when the countdown reads
            // `soon` (2–7 days) or `urgent` (≤1 day) the whole Respond by
            // row goes amber: icon, value, the inline countdown text — all
            // one colour family. Anything further out stays neutral so it
            // doesn't false-alarm. Tier 2 of fidelity-audit.md.
            const isAmber =
              countdown?.urgency === 'soon' || countdown?.urgency === 'urgent'
            // A-10b — Subtle pulse on the countdown text when we're at
            // the final-tier urgency (≤1 day). Per the mobile design,
            // "Pulse only on the final tier; constant flashing is
            // hostile." Reduced-motion users opt out via globals.css.
            const isUrgent = countdown?.urgency === 'urgent'
            const dateLabel = format(new Date(offer.expiry_date), 'd MMMM yyyy', { locale: dfLocale })
            // Localized countdown ("7 days left") — offerCountdown()'s own label
            // is English-only, so render it from daysLeft in the org locale (#5).
            const countdownLabel = countdown
              ? countdown.daysLeft === 0
                ? t('offer.expiresToday')
                : t('offer.daysLeft', { days: countdown.daysLeft })
              : null
            return (
              <div className="flex items-start gap-3">
                <Clock
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    isAmber ? 'text-[oklch(0.55_0.12_70)]' : 'text-gray-400',
                  )}
                  aria-hidden
                />
                <div className="flex-1">
                  <dt className="sr-only">{t('offer.respondBy')}</dt>
                  <dd
                    className={cn(
                      'font-semibold',
                      isAmber ? 'text-[oklch(0.45_0.12_60)]' : 'text-gray-700',
                    )}
                    aria-label={
                      countdownLabel ? `${t('offer.respondBy')} ${dateLabel} — ${countdownLabel}` : undefined
                    }
                  >
                    {dateLabel}
                    {countdownLabel && (
                      <>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span className={isUrgent ? 'animate-pulse-soft' : undefined}>
                          {countdownLabel}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              </div>
            )
          })()}
        </dl>

        <hr className="border-gray-200" />

        {/* Body — plain text with preserved line breaks; no markdown for v1.
            A-10: collapsed to 6 lines on mobile with a "Show full offer"
            toggle so Accept / Decline stay in viewport. Always full on sm+. */}
        <OfferBody body={offer.body} />

        {offer.recruiter_message && (
          <>
            <hr className="border-gray-200" />
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('offer.recruiterNote')}
              </h2>
              {/* Italic body per Public Offer.dc.html §1 — recruiter notes
                  read as personal voice, distinct from the formal offer
                  body. Tier 3 of fidelity-audit.md. */}
              <p className="mt-2 whitespace-pre-wrap text-sm italic leading-relaxed text-gray-700">
                {offer.recruiter_message}
              </p>
            </div>
          </>
        )}

        <hr className="border-gray-200" />

        {/* Status + action area */}
        <NextIntlClientProvider locale={contentLocale} messages={messages}>
          <StatusArea
            t={t}
            dfLocale={dfLocale}
            status={offer.status}
            token={token}
            respondedAt={offer.responded_at ?? null}
            recruiterName={offer.recruiter_name}
            recruiterEmail={offer.recruiter_email}
            roleTitle={offer.role_title}
            organizationName={companyName}
          />
        </NextIntlClientProvider>
        </div>
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs text-gray-500">
        {!responded && offer.sent_at && (
          <p>{t('offer.sentOn', { date: format(new Date(offer.sent_at), 'd MMMM yyyy', { locale: dfLocale }) })}</p>
        )}
        <p>{t('offer.keepPrivate')}</p>
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
  // Visible labels per Public Offer.dc.html — fixed 110px left column for the
  // label, value flows after it. The previous sr-only treatment hid the
  // labels from sighted users entirely. Tier 3 of fidelity-audit.md.
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      <dt className="w-[110px] shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm">{children}</dd>
    </div>
  )
}

function StatusArea({
  t,
  dfLocale,
  status,
  token,
  respondedAt,
  recruiterName,
  recruiterEmail,
  roleTitle,
  organizationName,
}: {
  t: Translator
  dfLocale: DateFnsLocale
  status: string
  token: string
  respondedAt: string | null
  recruiterName: string | null
  recruiterEmail: string | null
  roleTitle: string
  organizationName: string
}) {
  if (status === 'sent') {
    const mailto = recruiterEmail
      ? `mailto:${recruiterEmail}?subject=${encodeURIComponent(
          t('offer.questionSubject', { role: roleTitle, company: organizationName }),
        )}`
      : null
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{t('offer.readyPrompt')}</p>
        {mailto && (
          <p className="text-center text-xs text-gray-500">
            {t('offer.notSure')}{' '}
            <a
              href={mailto}
              className="font-semibold text-[oklch(0.45_0.16_250)] hover:underline"
            >
              {t('offer.askQuestion', { recruiter: recruiterName || t('offer.recruiterFallback') })}
            </a>
          </p>
        )}
        <OfferRespondForm token={token} />
      </div>
    )
  }
  if (status === 'accepted') {
    return (
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">
          {t('offer.accepted.title')} <span aria-hidden>🎉</span>
        </p>
        <p className="mt-1 text-sm text-emerald-800">{t('offer.accepted.body')}</p>
        {respondedAt && (
          <p className="mt-3 text-xs text-emerald-700/80">
            {t('offer.accepted.on', { date: format(new Date(respondedAt), 'd MMMM yyyy', { locale: dfLocale }) })}
          </p>
        )}
      </div>
    )
  }
  if (status === 'declined') {
    return (
      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900">{t('offer.declined.title')}</p>
        <p className="mt-1 text-sm text-gray-700">{t('offer.declined.body')}</p>
      </div>
    )
  }
  if (status === 'expired') {
    return (
      <div className="rounded-xl bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">{t('offer.expired.title')}</p>
        <p className="mt-1 text-sm text-amber-800">{t('offer.expired.body')}</p>
      </div>
    )
  }
  if (status === 'withdrawn') {
    return (
      <div className="rounded-xl bg-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900">{t('offer.withdrawn.title')}</p>
        <p className="mt-1 text-sm text-gray-700">{t('offer.withdrawn.body')}</p>
      </div>
    )
  }
  // 'draft' shouldn't be reachable (no public_token on drafts) but be defensive.
  return null
}

function formatCompensation(
  amount: number,
  currency: string | null,
  periodLabel: string,
  intlLocale: string,
): string {
  // Try Intl with the recruiter-supplied currency; fall back to a plain
  // numeric format if Intl rejects the code (it does for non-ISO strings).
  // Formatted in the org content locale so grouping/symbols read natively.
  let formatted = String(amount)
  if (currency) {
    try {
      formatted = new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      formatted = `${amount.toLocaleString(intlLocale)} ${currency}`
    }
  } else {
    formatted = amount.toLocaleString(intlLocale)
  }
  return periodLabel ? `${formatted} ${periodLabel}` : formatted
}

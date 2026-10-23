import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getPayment } from '@/lib/billing/payment-history'
import { formatAmountMinor, hasReceipt } from '@/lib/billing/payment-records'
import { planName } from '@/lib/pricing/plan-i18n'
import { BUSINESS_ID, BUSINESS_IDENTITY, SUPPORT_EMAIL } from '@/lib/legal/contact'
import { PAYMENT_PROVIDER, PAYMENT_PROVIDER_BRAND } from '@/lib/legal/payment-provider'
import { PrintButton } from '@/components/subscription/print-button'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('receipt')
  return { title: `${t('title')} · HRHandle`, robots: { index: false, follow: false } }
}

const DATE_LOCALE = { en: 'en-US', ka: 'ka-GE', ru: 'ru-RU' } as const

/**
 * A printable receipt for one paid charge (owner/admin of the paying org).
 * Outside the dashboard layout so "Print / Save as PDF" prints only the
 * receipt. The seller block comes from lib/legal/contact.ts, the processor
 * line from lib/legal/payment-provider.ts.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  const orgId = (profile?.organization_id as string | null | undefined) ?? null
  if (!orgId) redirect('/pipeline')
  if (profile?.role !== 'owner' && profile?.role !== 'admin') redirect('/pipeline')

  // Role checked above; getPayment reads with the service role, scoped to orgId.
  const payment = await getPayment(orgId, id)
  if (!payment || !hasReceipt(payment.status)) notFound()

  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()

  const t = await getTranslations()
  const rawLocale = await getLocale()
  const locale: keyof typeof DATE_LOCALE = rawLocale in DATE_LOCALE ? (rawLocale as keyof typeof DATE_LOCALE) : 'en'
  const fmt = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Tbilisi',
  })
  const seller = BUSINESS_IDENTITY[locale]
  const provider = PAYMENT_PROVIDER[locale]
  const paidAt = payment.paid_at ?? payment.created_at
  const refund =
    payment.reversal_amount_minor && payment.reversal_amount_minor > 0
      ? payment.reversal_amount_minor
      : payment.status === 'reversed'
        ? payment.amount_minor
        : null

  const rows: Array<[string, string | null | undefined]> = [
    [t('receipt.paymentDate'), fmt.format(new Date(paidAt))],
    [t('receipt.item'), `HRHandle ${planName(t, payment.plan_code)} · ${t(payment.billing_cycle === 'annual' ? 'planCards.annual' : 'planCards.monthly')}`],
    [t('receipt.method'), [payment.card_type, payment.masked_card].filter(Boolean).join(' ') || null],
    [t('receipt.paymentId'), payment.flitt_payment_id],
    [t('receipt.rrn'), payment.rrn],
    [t('receipt.approvalCode'), payment.approval_code],
  ]

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/settings/billing" className="text-sm text-muted-foreground hover:underline">
          ← {t('receipt.back')}
        </Link>
        <PrintButton label={t('receipt.print')} />
      </div>

      <article className="rounded-xl border border-border bg-background p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xl font-semibold text-foreground">HRHandle</p>
            <h1 className="mt-1 text-sm text-muted-foreground">{t('receipt.title')}</h1>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">{t('receipt.number')}</p>
            <p className="font-mono text-xs text-foreground">{payment.order_id}</p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-border py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('receipt.seller')}</p>
            <p className="font-medium text-foreground">{seller.name}</p>
            <p className="text-muted-foreground">{t('receipt.sellerId', { id: BUSINESS_ID })}</p>
            <p className="text-muted-foreground">{seller.address}</p>
            <p className="text-muted-foreground">{SUPPORT_EMAIL}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('receipt.billedTo')}</p>
            <p className="font-medium text-foreground">{payment.org_name ?? (org?.name as string | undefined) ?? ''}</p>
            {payment.payer_email && <p className="text-muted-foreground">{payment.payer_email}</p>}
            {payment.billing_country && <p className="text-muted-foreground">{payment.billing_country}</p>}
          </div>
        </div>

        <dl className="divide-y divide-border text-sm">
          {rows
            .filter(([, v]) => !!v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right text-foreground">{v}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-4 py-3 text-base font-semibold">
            <dt>{t('receipt.amountPaid')}</dt>
            <dd className="tabular-nums">{formatAmountMinor(payment.amount_minor, payment.currency)}</dd>
          </div>
          {refund !== null && (
            <div className="flex justify-between gap-4 py-2.5 text-red-700">
              <dt>{t('receipt.refunded')}</dt>
              <dd className="tabular-nums">
                −{formatAmountMinor(refund, payment.currency)}
                {payment.reversed_at && ` · ${fmt.format(new Date(payment.reversed_at))}`}
              </dd>
            </div>
          )}
        </dl>

        <footer className="mt-6 space-y-1 text-xs text-muted-foreground">
          <p>
            {t('receipt.processedBy', {
              brand: PAYMENT_PROVIDER_BRAND,
              operator: provider.operator,
              acquirer: provider.acquirer,
            })}
          </p>
          <p>{t('receipt.questions', { email: SUPPORT_EMAIL })}</p>
        </footer>
      </article>
    </main>
  )
}

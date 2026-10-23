import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Receipt } from 'lucide-react'
import { planName } from '@/lib/pricing/plan-i18n'
import type { PaymentRecord } from '@/lib/billing/payment-history'
import {
  cardLast4,
  formatAmountMinor,
  hasReceipt,
  PAYMENT_RECORD_RETENTION_YEARS,
  paymentRowStatus,
} from '@/lib/billing/payment-records'

const STATUS_CLASS = {
  paid: 'bg-green-100 text-green-800',
  refunded: 'bg-gray-100 text-gray-800',
  partly_refunded: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
} as const

const DATE_LOCALE = { en: 'en-US', ka: 'ka-GE', ru: 'ru-RU' } as const

/**
 * Billing → Payments: every charge, refund and failed attempt, with a printable
 * receipt per paid charge. Rows are kept 5 years (lib/billing/payment-records.ts).
 */
export async function PaymentHistory({ payments }: { payments: PaymentRecord[] }) {
  const t = await getTranslations()
  const locale = (await getLocale()) as keyof typeof DATE_LOCALE
  const fmt = new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tbilisi',
  })
  const rows = payments
    .map((p) => ({ p, status: paymentRowStatus(p) }))
    .filter((r): r is { p: PaymentRecord; status: NonNullable<ReturnType<typeof paymentRowStatus>> } => r.status !== null)

  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{t('paymentHistory.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('paymentHistory.kept', { years: PAYMENT_RECORD_RETENTION_YEARS })}</p>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">{t('paymentHistory.empty')}</p>
      ) : (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">{t('paymentHistory.date')}</th>
                <th className="px-3 py-2 font-medium">{t('paymentHistory.plan')}</th>
                <th className="px-3 py-2 font-medium">{t('paymentHistory.amount')}</th>
                <th className="px-3 py-2 font-medium">{t('paymentHistory.status')}</th>
                <th className="px-5 py-2 text-right font-medium">
                  <span className="sr-only">{t('paymentHistory.receipt')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ p, status }) => {
                const last4 = cardLast4(p.masked_card)
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums">
                      {fmt.format(new Date(p.paid_at ?? p.created_at))}
                    </td>
                    <td className="px-3 py-2.5">
                      {planName(t, p.plan_code)} ·{' '}
                      {t(p.billing_cycle === 'annual' ? 'planCards.annual' : 'planCards.monthly')}
                      {last4 && <span className="ml-1.5 text-muted-foreground">•••• {last4}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      {formatAmountMinor(p.amount_minor, p.currency)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
                        {t(`paymentHistory.statusLabel.${status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {hasReceipt(p.status) && (
                        <Link
                          href={`/receipts/${p.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Receipt className="h-3.5 w-3.5" aria-hidden />
                          {t('paymentHistory.receipt')}
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

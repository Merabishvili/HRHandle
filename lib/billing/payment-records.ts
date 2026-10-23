/**
 * Payment records — pure helpers (no I/O, unit-tested).
 *
 * Every payment row is kept for PAYMENT_RECORD_RETENTION_YEARS from its last
 * transaction, also after the organization is deleted (migration
 * 20261023_payment_records.sql): the merchant agreement requires card-payment
 * records to be kept that long, Privacy §7 promises it, and the rows are the
 * customer's receipts and our evidence in a dispute.
 */
import type { FlittCallback } from '@/lib/flitt/types'
import { CURRENCY_SYMBOL } from '@/lib/pricing/currency'

export const PAYMENT_RECORD_RETENTION_YEARS = 5

/** `from` + the retention period (calendar years, UTC). */
export function retainUntil(from: Date): Date {
  const d = new Date(from.getTime())
  d.setUTCFullYear(d.getUTCFullYear() + PAYMENT_RECORD_RETENTION_YEARS)
  return d
}

/**
 * Flitt masks the card itself (`444455XXXXXX1111` / `4444 55** **** 1111`).
 * Keep the value only if it really is masked, so a full card number can never
 * be stored by mistake.
 */
export function safeMaskedCard(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v || v.length > 32) return null
  const digits = v.replace(/\D/g, '')
  if (!/[X*x•]/.test(v)) return null
  if (digits.length > 10) return null // at most first 6 + last 4 are visible
  return v
}

/** Last four digits of a masked card for display ("•••• 1111"), or null. */
export function cardLast4(masked: string | null | undefined): string | null {
  if (!masked) return null
  const m = /(\d{4})\s*$/.exec(masked)
  return m ? m[1]! : null
}

function str(v: unknown, max = 64): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim()
  return s && s.length <= max ? s : null
}

export interface TransactionDetails {
  masked_card?: string
  card_type?: string
  rrn?: string
  approval_code?: string
  paid_at?: string
  reversal_amount_minor?: number
  reversed_at?: string
  retain_until: string
}

/**
 * The non-sensitive transaction details from a verified callback, for the
 * payment row: what prints on the receipt and backs a dispute. Never the
 * payer's contact data or the whole payload.
 */
export function transactionDetails(cb: FlittCallback, now: Date): TransactionDetails {
  const out: TransactionDetails = { retain_until: retainUntil(now).toISOString() }
  const masked = safeMaskedCard(cb.masked_card)
  if (masked) out.masked_card = masked
  const cardType = str(cb.card_type, 32) ?? str(cb.payment_system, 32)
  if (cardType) out.card_type = cardType
  const rrn = str(cb.rrn, 32)
  if (rrn) out.rrn = rrn
  const approval = str(cb.approval_code, 32)
  if (approval) out.approval_code = approval
  if (cb.order_status === 'approved') out.paid_at = now.toISOString()
  const reversal = Number(cb.reversal_amount ?? 0)
  if (Number.isFinite(reversal) && reversal > 0) {
    out.reversal_amount_minor = Math.round(reversal)
    out.reversed_at = now.toISOString()
  }
  return out
}

/** Statuses that mean the payer was charged — these rows get a receipt. */
export const RECEIPT_STATUSES = ['approved', 'reversed'] as const

export function hasReceipt(status: string): boolean {
  return (RECEIPT_STATUSES as readonly string[]).includes(status)
}

/** First address in x-forwarded-for (Vercel), else x-real-ip, else null. */
export function clientIp(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for')
  const first = fwd?.split(',')[0]?.trim()
  const ip = first || h.get('x-real-ip')?.trim() || ''
  return ip && ip.length <= 64 ? ip : null
}

/** Minor units → "₾49.00" (symbol from CURRENCY_SYMBOL; unknown currency → code). */
export function formatAmountMinor(amountMinor: number, currency: string): string {
  const symbol = (CURRENCY_SYMBOL as Record<string, string>)[currency]
  const major = (amountMinor / 100).toFixed(2)
  return symbol ? `${symbol}${major}` : `${major} ${currency}`
}

/** What the payments list shows for a row. */
export type PaymentRowStatus = 'paid' | 'refunded' | 'partly_refunded' | 'failed'

export function paymentRowStatus(row: {
  status: string
  reversal_amount_minor?: number | null
  amount_minor: number
}): PaymentRowStatus | null {
  if (row.status === 'reversed') return 'refunded'
  if (row.status === 'approved') {
    const r = row.reversal_amount_minor ?? 0
    if (r > 0) return r >= row.amount_minor ? 'refunded' : 'partly_refunded'
    return 'paid'
  }
  if (row.status === 'declined' || row.status === 'expired') return 'failed'
  return null // pending / created / processing: not a payment yet
}

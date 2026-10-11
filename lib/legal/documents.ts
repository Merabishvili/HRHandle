/**
 * Shared facts for the public legal pages (Terms, Privacy, Refund) — one source
 * so the EN/KA/RU versions and the billing page can't drift apart.
 */

export type LegalDoc = 'terms' | 'privacy' | 'refund'

/** "Last updated" date per document (YYYY-MM-DD). Bump when the text changes. */
export const LEGAL_UPDATED: Record<LegalDoc, string> = {
  terms: '2026-10-09',
  privacy: '2026-10-09',
  refund: '2026-10-09',
}

/**
 * Refund policy numbers (decisions 2026-10-09). The KA/RU texts are worded for
 * these exact values (e.g. Russian "3 месяца", "7 дней") — if you change one,
 * re-check the grammar around it in components/legal/content/*-ka|ru.tsx.
 */
export const REFUND_REQUEST_DAYS = 7 // calendar days after the payment to ask
export const REFUND_PAYOUT_BUSINESS_DAYS = 14 // we send an approved refund within
export const REFUND_LIMIT_MONTHS = 3 // at most one refund per organization per window

const DATE_LOCALE = { en: 'en-US', ka: 'ka-GE', ru: 'ru-RU' } as const

/** "Last updated" date in a page's language (fixed UTC date, no drift). */
export function formatLegalDate(doc: LegalDoc, locale: keyof typeof DATE_LOCALE): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${LEGAL_UPDATED[doc]}T00:00:00Z`))
}

/** Days a failed renewal keeps working — mirrors lib/billing/access.ts. */
export { RENEWAL_GRACE_DAYS } from '@/lib/billing/access'

'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

/**
 * "We accept" row — Visa / Mastercard / Google Pay / Apple Pay marks shown on
 * the pricing + billing surfaces. Displaying the accepted card brands is a
 * payment-provider (Flitt) pre-production requirement. Lightweight inline marks;
 * swap for official brand assets any time.
 */
export function PaymentMethods({ className }: { className?: string }) {
  const t = useTranslations()
  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
      <span className="text-xs text-muted-foreground">{t('payMethods.secure')}</span>

      {/* Visa */}
      <svg width="40" height="26" viewBox="0 0 40 26" role="img" aria-label="Visa" className="shrink-0">
        <rect x="0.5" y="0.5" width="39" height="25" rx="4" fill="#fff" stroke="#e5e7eb" />
        <text
          x="20"
          y="17"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontStyle="italic"
          fontSize="12"
          fill="#1A1F71"
        >
          VISA
        </text>
      </svg>

      {/* Mastercard */}
      <svg width="40" height="26" viewBox="0 0 40 26" role="img" aria-label="Mastercard" className="shrink-0">
        <rect x="0.5" y="0.5" width="39" height="25" rx="4" fill="#fff" stroke="#e5e7eb" />
        <circle cx="17" cy="13" r="7" fill="#EB001B" />
        <circle cx="24" cy="13" r="7" fill="#F79E1B" fillOpacity="0.9" />
      </svg>

      {/* Google Pay */}
      <span
        className="inline-flex h-[26px] items-center rounded border border-[#e5e7eb] bg-white px-2 text-[11px] font-semibold text-[#5f6368]"
        aria-label="Google Pay"
      >
        G&nbsp;Pay
      </span>

      {/* Apple Pay */}
      <span
        className="inline-flex h-[26px] items-center rounded border border-[#e5e7eb] bg-white px-2 text-[11px] font-semibold text-black"
        aria-label="Apple Pay"
      >
        Apple&nbsp;Pay
      </span>
    </div>
  )
}

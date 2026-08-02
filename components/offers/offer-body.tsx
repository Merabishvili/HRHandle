'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  body: string
}

/**
 * A-10 — Collapses long offer bodies on mobile so Accept / Decline
 * stay visible without a long scroll. The compensation, role, start
 * date and respond-by are all in the hero card above; the body is
 * the legalish detail that doesn't need to dominate the page.
 *
 * On sm+ the body always renders in full (desktop has plenty of room).
 * On mobile we clamp to 6 lines until the user expands.
 */
export function OfferBody({ body }: Props) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  // Heuristic: only show the toggle when the body is genuinely long.
  // Avoids "Show full offer" appearing for a 2-line offer.
  const looksLong = body.length > 320 || (body.match(/\n/g)?.length ?? 0) > 4

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Offer details
      </h2>
      <p
        className={
          looksLong && !expanded
            ? 'mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 sm:line-clamp-none'
            : 'mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800'
        }
      >
        {body}
      </p>
      {looksLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.45_0.16_250)] hover:underline sm:hidden"
        >
          {expanded ? (
            <>
              {t('offer.showLess')} <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <>
              {t('offer.showFull')} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </button>
      )}
    </div>
  )
}

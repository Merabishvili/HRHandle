'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  title: string
  body: string
}

/**
 * A-9b — Collapsible job-description block for the public apply page.
 *
 * The page renders three of these (About the job / Responsibilities /
 * Requirements). On mobile, each clamps to 4 lines with a "Show more"
 * toggle so the form below stays close to the fold; on `sm+` the body
 * is always rendered in full.
 *
 * The toggle only surfaces when the body is genuinely long — short
 * descriptions render as-is. Match heuristic with `OfferBody`:
 * > 320 chars OR > 4 newlines.
 */
export function JobDescriptionBlock({ title, body }: Props) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)

  // Empty / whitespace-only sections render nothing — never a bare heading
  // over blank space (or a stray placeholder character). The callers also
  // gate on a truthy field, but this is the defensive backstop for
  // whitespace-only content.
  if (!body || !body.trim()) return null

  const looksLong = body.length > 320 || (body.match(/\n/g)?.length ?? 0) > 4

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div
        className={
          looksLong && !expanded
            ? 'whitespace-pre-wrap text-sm text-gray-700 line-clamp-4 sm:line-clamp-none'
            : 'whitespace-pre-wrap text-sm text-gray-700'
        }
      >
        {body}
      </div>
      {looksLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.45_0.16_250)] hover:underline sm:hidden"
        >
          {expanded ? (
            <>
              {t('offer.showLess')} <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <>
              {t('jobDesc.showMore')} <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </button>
      )}
    </div>
  )
}

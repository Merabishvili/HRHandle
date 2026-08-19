'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IntegrationPromptProvider } from '@/lib/integrations/prompt'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Post-signup nudge to connect the meeting/calendar integration matching the
 * user's OAuth provider. Dismissal is stored in a cookie the server component
 * reads, so it stays dismissed across page loads. */
export function IntegrationConnectBanner({
  provider,
}: {
  provider: IntegrationPromptProvider
}) {
  const t = useTranslations()
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  const connectHref = provider === 'google' ? '/api/auth/google' : '/api/auth/microsoft'
  const title =
    provider === 'google'
      ? t('integrations.promptGoogleTitle')
      : t('integrations.promptMicrosoftTitle')
  const desc =
    provider === 'google'
      ? t('integrations.promptGoogleDesc')
      : t('integrations.promptMicrosoftDesc')

  function dismiss() {
    document.cookie = `int_prompt_dismissed=1; path=/; max-age=${ONE_YEAR}; samesite=lax`
    setHidden(true)
  }

  return (
    <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm">
          <a href={connectHref}>{t('integrations.promptConnect')}</a>
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('integrations.promptDismiss')}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

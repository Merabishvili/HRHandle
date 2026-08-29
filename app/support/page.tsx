import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { SupportForm } from '@/components/support/support-form'

export const metadata: Metadata = {
  title: 'Support — HRHandle',
}

/**
 * Public support page — reachable without a session (e.g. prospects or
 * locked-out users). Adds an email field + Turnstile (in the form) since there
 * is no session to derive identity from.
 */
export default async function PublicSupportPage() {
  const t = await getTranslations()
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t('support.backHome')}
          </Link>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">{t('support.title')}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{t('support.publicSubtitle')}</p>
        <SupportForm isPublic />
      </div>
    </div>
  )
}

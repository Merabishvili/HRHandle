import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { SupportForm } from '@/components/support/support-form'
import { SUPPORT_EMAIL } from '@/lib/legal/contact'

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
        {/* Hours, response time and channels — Zoom Marketplace review requires
            them on the app's Support URL (this page). */}
        <section className="mb-8 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          <h2 className="mb-2 font-semibold text-foreground">{t('support.help.title')}</h2>
          <ul className="space-y-1">
            <li>{t('support.help.hours')}</li>
            <li>{t('support.help.response')}</li>
            <li>
              {t.rich('support.help.email', {
                email: (c) => (
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                    {c}
                  </a>
                ),
              })}
            </li>
            <li>{t('support.help.form')}</li>
            <li>
              {t.rich('support.help.guide', {
                link: (c) => (
                  <Link href="/guide" className="text-primary hover:underline">
                    {c}
                  </Link>
                ),
              })}
            </li>
            <li>
              {t.rich('support.help.zoom', {
                link: (c) => (
                  <Link href="/guide/zoom" className="text-primary hover:underline">
                    {c}
                  </Link>
                ),
              })}
            </li>
          </ul>
        </section>
        <SupportForm isPublic />
      </div>
    </div>
  )
}

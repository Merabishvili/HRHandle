import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/landing/language-switcher'
import { LEGAL_CONTENT } from '@/components/legal/content'
import { formatLegalDate, type LegalDoc } from '@/lib/legal/documents'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales'

const OTHER_DOCS: Record<LegalDoc, LegalDoc[]> = {
  terms: ['privacy', 'refund'],
  privacy: ['terms', 'refund'],
  refund: ['terms', 'privacy'],
}

/**
 * Shared frame for the public legal pages (Terms, Privacy, Refund): back link,
 * language switcher, title, last-updated date, the "English prevails" note on
 * translations (decision 2026-10-09), and links to the other two documents.
 */
export async function LegalPage({
  doc,
  locale,
  children,
}: {
  doc: LegalDoc
  locale: Locale
  children: ReactNode
}) {
  const t = await getTranslations({ locale, namespace: 'legal' })
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('back')}
          </Link>
          <LanguageSwitcher current={locale} />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-foreground">{t(`title.${doc}`)}</h1>
        <p className="text-sm text-muted-foreground">
          {t('lastUpdated', { date: formatLegalDate(doc, locale) })}
        </p>
        {locale !== 'en' && (
          <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t('englishPrevails')}
          </p>
        )}

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground">{children}</div>

        <div className="mt-12 flex flex-wrap gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
          {OTHER_DOCS[doc].map((other) => (
            <Link key={other} href={`/${other}`} className="hover:text-foreground">
              {t(`title.${other}`)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The visitor's language (NEXT_LOCALE cookie, as on the landing page). */
async function legalLocale(): Promise<Locale> {
  const raw = await getLocale()
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

/** Localized `<title>` for a legal page (the root layout's template adds
 * " — HRHandle"; the old hard-coded suffix doubled it). */
export async function legalMetadata(doc: LegalDoc): Promise<Metadata> {
  const t = await getTranslations({ locale: await legalLocale(), namespace: 'legal' })
  return { title: t(`title.${doc}`) }
}

/** A legal document in the visitor's language, inside the shared frame. */
export async function LegalDocPage({ doc }: { doc: LegalDoc }) {
  const locale = await legalLocale()
  const Content = LEGAL_CONTENT[doc][locale]
  return (
    <LegalPage doc={doc} locale={locale}>
      <Content />
    </LegalPage>
  )
}

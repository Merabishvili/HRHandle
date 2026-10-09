import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { CATEGORY_KEY, GUIDE_FAQ_KEYS, getGuidesByCategory, type GuideCategory } from '@/lib/guides/registry'
import { listExistingGuideSlugs } from '@/lib/guides/loader'
import { visitorLocale } from '@/lib/i18n/visitor-locale'
import { GuideShell } from '@/components/guide/guide-shell'
import { GuideCard } from '@/components/guide/guide-card'

// Shown in the visitor's language (NEXT_LOCALE cookie) with a language switcher,
// like the landing and legal pages.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: await visitorLocale(), namespace: 'guide' })
  return {
    title: t('indexTitle'),
    description: t('metaDescription'),
    alternates: { canonical: 'https://hrhandle.com/guide' },
  }
}

export default async function GuideIndexPage() {
  const locale = await visitorLocale()
  const t = await getTranslations({ locale, namespace: 'guide' })
  const existingSlugs = new Set(await listExistingGuideSlugs())

  return (
    <GuideShell locale={locale}>
      <div className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('indexTitle')}</h1>
        <p className="max-w-2xl text-base text-muted-foreground">{t('indexIntro')}</p>
      </div>

      <div className="space-y-10">
        {Object.entries(getGuidesByCategory()).map(([category, guides]) => (
          <section key={category}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`category.${CATEGORY_KEY[category as GuideCategory]}`)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <GuideCard key={guide.slug} locale={locale} guide={guide} exists={existingSlugs.has(guide.slug)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <h2 className="mb-6 text-2xl font-semibold text-foreground">{t('faqTitle')}</h2>
        <div className="space-y-6">
          {GUIDE_FAQ_KEYS.map((key) => (
            <div key={key}>
              <h3 className="mb-1 font-medium text-foreground">{t(`faq.${key}.q`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`faq.${key}.a`)}</p>
            </div>
          ))}
        </div>
      </section>
    </GuideShell>
  )
}

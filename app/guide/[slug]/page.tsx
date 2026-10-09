import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { getGuideBySlug, LEGACY_GUIDE_SLUGS } from '@/lib/guides/registry'
import { listExistingGuideSlugs, loadGuide } from '@/lib/guides/loader'
import { visitorLocale } from '@/lib/i18n/visitor-locale'
import { GuideShell } from '@/components/guide/guide-shell'
import { GuideSidebar } from '@/components/guide/guide-sidebar'
import { guideMdxComponents } from '@/components/guide/mdx-components'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const meta = getGuideBySlug(slug)
  if (!meta) return {}
  const t = await getTranslations({ locale: await visitorLocale(), namespace: 'guide' })
  return {
    title: `${t(`topic.${meta.id}.title`)} · ${t('indexTitle')}`,
    description: t(`topic.${meta.id}.summary`),
    alternates: { canonical: `https://hrhandle.com/guide/${slug}` },
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const renamedTo = LEGACY_GUIDE_SLUGS[slug]
  if (renamedTo) permanentRedirect(`/guide/${renamedTo}`)

  const locale = await visitorLocale()
  const guide = await loadGuide(slug, locale)
  if (!guide) notFound()

  const t = await getTranslations({ locale, namespace: 'guide' })
  const existingSlugs = new Set(await listExistingGuideSlugs())

  return (
    <GuideShell locale={locale}>
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <GuideSidebar locale={locale} currentSlug={slug} existingSlugs={existingSlugs} />
        </aside>
        <article className="min-w-0">
          <header className="mb-8 border-b border-border pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {t(`topic.${guide.meta.id}.title`)}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">{t(`topic.${guide.meta.id}.summary`)}</p>
            {guide.locale !== locale && (
              <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t('notTranslated')}
              </p>
            )}
          </header>
          <div className="prose-styles">
            <MDXRemote
              source={guide.content}
              components={guideMdxComponents(guide.locale)}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
        </article>
      </div>
    </GuideShell>
  )
}

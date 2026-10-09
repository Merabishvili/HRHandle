import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { CATEGORY_KEY, getGuidesByCategory } from '@/lib/guides/registry'
import type { Locale } from '@/lib/i18n/locales'

interface GuideSidebarProps {
  locale: Locale
  currentSlug: string
  existingSlugs: Set<string>
}

export async function GuideSidebar({ locale, currentSlug, existingSlugs }: GuideSidebarProps) {
  const t = await getTranslations({ locale, namespace: 'guide' })

  return (
    <nav className="sticky top-20 space-y-6 text-sm">
      {Object.entries(getGuidesByCategory()).map(([category, guides]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`category.${CATEGORY_KEY[category as keyof typeof CATEGORY_KEY]}`)}
          </p>
          <ul className="space-y-1">
            {guides.map((guide) => {
              const title = t(`topic.${guide.id}.title`)
              if (!existingSlugs.has(guide.slug)) {
                return (
                  <li key={guide.slug} className="rounded px-2 py-1 text-muted-foreground/50">
                    {title}
                  </li>
                )
              }
              const isCurrent = guide.slug === currentSlug
              return (
                <li key={guide.slug}>
                  <Link
                    href={`/guide/${guide.slug}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`block rounded px-2 py-1 transition-colors ${
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

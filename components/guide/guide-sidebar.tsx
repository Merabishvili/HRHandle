import Link from 'next/link'
import { CATEGORY_LABELS, GUIDES, type GuideCategory, type GuideMeta } from '@/lib/guides/registry'

interface GuideSidebarProps {
  currentSlug: string
  existingSlugs: Set<string>
}

export function GuideSidebar({ currentSlug, existingSlugs }: GuideSidebarProps) {
  const grouped = new Map<GuideCategory, GuideMeta[]>()
  for (const guide of [...GUIDES].sort((a, b) => a.order - b.order)) {
    if (!grouped.has(guide.category)) grouped.set(guide.category, [])
    grouped.get(guide.category)!.push(guide)
  }

  return (
    <nav className="sticky top-20 space-y-6 text-sm">
      {Array.from(grouped.entries()).map(([category, guides]) => (
        <div key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category]}
          </p>
          <ul className="space-y-1">
            {guides.map((guide) => {
              const exists = existingSlugs.has(guide.slug)
              const isCurrent = guide.slug === currentSlug
              if (!exists) {
                return (
                  <li
                    key={guide.slug}
                    className="rounded px-2 py-1 text-muted-foreground/50"
                  >
                    {guide.title}
                  </li>
                )
              }
              return (
                <li key={guide.slug}>
                  <Link
                    href={`/guide/${guide.slug}`}
                    className={`block rounded px-2 py-1 transition-colors ${
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {guide.title}
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

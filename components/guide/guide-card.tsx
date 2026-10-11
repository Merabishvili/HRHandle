import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuideMeta } from '@/lib/guides/registry'
import type { Locale } from '@/lib/i18n/locales'

interface GuideCardProps {
  locale: Locale
  guide: GuideMeta
  exists: boolean
}

export async function GuideCard({ locale, guide, exists }: GuideCardProps) {
  const t = await getTranslations({ locale, namespace: 'guide' })
  // Design fix: "Coming soon" cards use a dashed border + muted bg so they
  // read as deliberately deferred rather than broken links. Live guides keep
  // the solid border and hover affordance.
  const cardClasses = exists
    ? 'h-full border-border transition-colors hover:border-foreground/20'
    : 'h-full border-dashed border-border/70 bg-muted/30'

  const inner = (
    <Card className={cardClasses}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className={exists ? '' : 'text-muted-foreground'}>{t(`topic.${guide.id}.title`)}</span>
          {exists && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t(`topic.${guide.id}.summary`)}</p>
        {!exists && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            {t('comingSoon')}
          </p>
        )}
      </CardContent>
    </Card>
  )

  if (!exists) {
    return <div aria-disabled="true">{inner}</div>
  }

  return (
    <Link href={`/guide/${guide.slug}`} className="block">
      {inner}
    </Link>
  )
}

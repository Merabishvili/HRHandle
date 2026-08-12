import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuideMeta } from '@/lib/guides/registry'

interface GuideCardProps {
  guide: GuideMeta
  exists: boolean
}

export async function GuideCard({ guide, exists }: GuideCardProps) {
  const t = await getTranslations()
  // Design fix: "Coming soon" cards use a dashed border + muted bg so they
  // read as deliberately deferred rather than broken links. Live guides keep
  // the solid border and hover affordance.
  const cardClasses = exists
    ? 'h-full border-border transition-colors hover:border-foreground/20'
    : 'h-full border-dashed border-border/70 bg-muted/30'

  const inner = (
    <Card className={cardClasses}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className={exists ? '' : 'text-muted-foreground'}>{guide.title}</span>
          {exists && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{guide.summary}</p>
        {!exists && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            {t('guide.comingSoon')}
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

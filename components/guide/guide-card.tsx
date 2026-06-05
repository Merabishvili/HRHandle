import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuideMeta } from '@/lib/guides/registry'

interface GuideCardProps {
  guide: GuideMeta
  exists: boolean
}

export function GuideCard({ guide, exists }: GuideCardProps) {
  const inner = (
    <Card className="h-full border-border transition-colors hover:border-foreground/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{guide.title}</span>
          {exists && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{guide.summary}</p>
        {!exists && (
          <p className="mt-3 text-xs text-muted-foreground/70">Coming soon</p>
        )}
      </CardContent>
    </Card>
  )

  if (!exists) {
    return <div className="opacity-60">{inner}</div>
  }

  return (
    <Link href={`/guide/${guide.slug}`} className="block">
      {inner}
    </Link>
  )
}

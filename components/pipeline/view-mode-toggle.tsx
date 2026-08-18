'use client'

import { useTranslations } from 'next-intl'
import { LayoutGrid, List as ListIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'board' | 'list'

export function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (next: ViewMode) => void
}) {
  const t = useTranslations()
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-border bg-muted/30 text-xs"
      role="group"
      aria-label={t('pipeline.viewMode')}
    >
      <button
        type="button"
        onClick={() => onChange('board')}
        aria-pressed={viewMode === 'board'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 transition-colors',
          viewMode === 'board'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        {t('pipeline.board')}
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={viewMode === 'list'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 transition-colors',
          viewMode === 'list'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <ListIcon className="h-3.5 w-3.5" aria-hidden />
        {t('pipeline.list')}
      </button>
    </div>
  )
}

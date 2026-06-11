import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Composed skeleton kit used by every `loading.tsx` under app/(dashboard).
// All variants build on the existing `<Skeleton>` primitive, which already
// adapts to light/dark mode (`bg-accent`). Sizes mirror the real chrome so
// streaming the skeleton-then-real-content doesn't shift layout.

interface SkeletonTextProps {
  /** Pre-set widths so callers don't have to memorise Tailwind classes. */
  width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

const WIDTH_MAP: Record<NonNullable<SkeletonTextProps['width']>, string> = {
  xs: 'w-12',
  sm: 'w-24',
  md: 'w-40',
  lg: 'w-64',
  xl: 'w-80',
  full: 'w-full',
}

export function SkeletonText({ width = 'md', className }: SkeletonTextProps) {
  return <Skeleton className={cn('h-4 rounded', WIDTH_MAP[width], className)} />
}

export function SkeletonCircle({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <Skeleton
      style={{ width: size, height: size }}
      className={cn('rounded-full', className)}
    />
  )
}

export function SkeletonBlock({
  height = 'md',
  className,
}: {
  height?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const HEIGHT_MAP: Record<NonNullable<typeof height>, string> = {
    sm: 'h-8',
    md: 'h-20',
    lg: 'h-40',
    xl: 'h-64',
  }
  return <Skeleton className={cn('w-full rounded-lg', HEIGHT_MAP[height], className)} />
}

/** Header chrome for both list and detail pages: a tall title line + a smaller
 * subtitle line, with optional right-aligned action placeholders. */
export function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
      )}
    </div>
  )
}

/** Toolbar above tables (search input + filter chips). Two stacked-then-row
 * lines on small screens, matched to `VacanciesToolbar` / `CandidatesToolbar`. */
export function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  )
}

/** Filter chip row sitting between the toolbar and the table. */
export function FilterPillsSkeleton({ pills = 4 }: { pills?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: pills }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-20 rounded-full" />
      ))}
    </div>
  )
}

interface TableSkeletonProps {
  rows?: number
  cols?: number
  /** When true (default), draws a header row + the body rows. */
  withHeader?: boolean
  className?: string
}

export function TableSkeleton({
  rows = 8,
  cols = 5,
  withHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-border', className)}>
      {withHeader && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-2/3 rounded" />
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3">
            <div
              className="grid items-center gap-4"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {Array.from({ length: cols }).map((_, colIdx) => (
                <Skeleton
                  key={colIdx}
                  className={cn(
                    'h-4 rounded',
                    // Vary widths a touch so the skeleton doesn't look gridded.
                    colIdx === 0 ? 'w-3/4' : colIdx === cols - 1 ? 'w-1/3' : 'w-2/3',
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Pagination strip placeholder — matches `<TablePagination>` height. */
export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between border-t border-border px-2 pt-4">
      <Skeleton className="h-4 w-40 rounded" />
      <div className="flex items-center gap-1">
        <Skeleton className="h-8 w-9 rounded-md" />
        <Skeleton className="h-8 w-9 rounded-md" />
        <Skeleton className="h-8 w-9 rounded-md" />
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/ui/page-skeleton'

// BL-006: vacancy detail page runs ~6 parallel queries (applications, questions,
// rejection reasons/templates, custom-field schema + values, profile). The
// skeleton mirrors the actual layout: header → tab strip → applications
// (list left, overview right).
export default function VacancyDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={3} />

      {/* Status / sector / dates strip — single row of small chips */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Tab strip */}
      <div className="border-b border-border">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
      </div>

      {/* Applications tab content placeholder (default tab) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-full max-w-sm rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
          <TableSkeleton rows={6} cols={5} />
        </div>

        <aside className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </aside>
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import {
  PageHeaderSkeleton,
  SkeletonCircle,
} from '@/components/ui/page-skeleton'

// BL-006: dashboard runs the heaviest fan-out of any page (KPI counts + recent
// candidates + recent vacancies + activity). Skeleton matches the actual
// layout: header → 4 KPI tiles → 2-column lists below.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* KPI tiles */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <SkeletonCircle size={18} />
            </div>
            <Skeleton className="mt-3 h-8 w-16 rounded" />
            <Skeleton className="mt-2 h-3 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Recent candidates + recent vacancies columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, columnIdx) => (
          <div key={columnIdx} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-3">
                  <SkeletonCircle size={32} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5 rounded" />
                    <Skeleton className="h-3 w-2/5 rounded" />
                  </div>
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

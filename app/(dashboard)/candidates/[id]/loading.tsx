import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonCircle, PageHeaderSkeleton } from '@/components/ui/page-skeleton'

// BL-006: candidate detail page runs ~8 parallel queries (candidate, applications,
// vacancies, statuses, questions, evaluations, custom fields, interviews,
// documents, activity). Mirrors the actual two-column layout: left column
// (profile + applications + experience + education + activity), right rail
// (AI tools + contact + documents + interviews).
export default function CandidateDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={2} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — profile + sections */}
        <div className="space-y-4 lg:col-span-2">
          {/* Profile card */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
            <SkeletonCircle size={56} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-4 w-64 rounded" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>

          {/* Applications card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="mb-4 h-5 w-40 rounded" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>

          {/* Experience / Education / Additional info */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="mb-4 h-5 w-32 rounded" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            </div>
          ))}

          {/* Activity feed */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="mb-4 h-5 w-32 rounded" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <SkeletonCircle size={28} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="mb-3 h-4 w-32 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

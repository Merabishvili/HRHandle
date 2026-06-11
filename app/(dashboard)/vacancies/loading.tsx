import {
  PageHeaderSkeleton,
  ToolbarSkeleton,
  FilterPillsSkeleton,
  TableSkeleton,
  PaginationSkeleton,
} from '@/components/ui/page-skeleton'

// BL-006: streamed by Next.js while `app/(dashboard)/vacancies/page.tsx`
// runs its server queries. Shape matches the real page — header → toolbar →
// status pill row → table → pagination — so swapping in real content keeps
// layout stable (no CLS jank).
export default function VacanciesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <ToolbarSkeleton />
      <FilterPillsSkeleton pills={5} />
      <TableSkeleton rows={8} cols={6} />
      <PaginationSkeleton />
    </div>
  )
}

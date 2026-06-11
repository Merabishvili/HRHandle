import {
  PageHeaderSkeleton,
  ToolbarSkeleton,
  FilterPillsSkeleton,
  TableSkeleton,
  PaginationSkeleton,
} from '@/components/ui/page-skeleton'

// BL-006: streamed by Next.js while `app/(dashboard)/candidates/page.tsx`
// runs its server queries.
export default function CandidatesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <ToolbarSkeleton />
      <FilterPillsSkeleton pills={6} />
      <TableSkeleton rows={8} cols={5} />
      <PaginationSkeleton />
    </div>
  )
}

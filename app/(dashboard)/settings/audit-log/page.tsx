import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Download } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listAuditLog, listOrgMembersForFilter } from '@/lib/actions/audit-log'
import { parseAuditLogFilter, filterToSearchParams } from '@/lib/audit-log/filter'
import { parsePageSize, type PageSize } from '@/lib/pagination'
import { AuditLogFilters } from '@/components/settings/audit-log-filters'
import { AuditLogTable } from '@/components/settings/audit-log-table'
import { TablePagination } from '@/components/ui/table-pagination'
import { Button } from '@/components/ui/button'

type SearchParams = Promise<{
  action?: string
  entityType?: string
  userId?: string
  from?: string
  to?: string
  page?: string
  pageSize?: string
}>

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/pipeline')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const sp = await searchParams
  const filter = parseAuditLogFilter(sp)
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const pageSize: PageSize = parsePageSize(sp.pageSize)

  const [logResult, membersResult] = await Promise.all([
    listAuditLog(filter, page, pageSize),
    listOrgMembersForFilter(),
  ])

  if (!logResult.success) redirect('/settings/profile')

  const totalPages = Math.max(1, Math.ceil(logResult.data.total / pageSize))

  // Preserved URL params for the paginator's links. Plain object (not a
  // function prop) so it serialises across the server→client boundary.
  const paginationPreserved = filterToSearchParams(filter)

  const exportHref = (() => {
    const params = new URLSearchParams(filterToSearchParams(filter))
    return `/api/export/audit-log?${params.toString()}`
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Audit log</h2>
          <p className="text-sm text-muted-foreground">
            Every meaningful action in your workspace — status changes, AI invocations, OAuth connects, deletes, offers — captured here for compliance and incident review. Read-only.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={exportHref}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export CSV
          </Link>
        </Button>
      </div>

      <AuditLogFilters
        filter={filter}
        members={membersResult.success ? membersResult.data : []}
      />

      <AuditLogTable rows={logResult.data.rows} />

      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalCount={logResult.data.total}
        pageSize={pageSize}
        basePath="/settings/audit-log"
        preservedParams={paginationPreserved}
        ariaLabel="Audit log pagination"
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import type { AuditLogRow } from '@/lib/actions/audit-log'

interface AuditLogTableProps {
  rows: AuditLogRow[]
}

export function AuditLogTable({ rows }: AuditLogTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium text-foreground">No activity matches these filters.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a wider date range or clear filters to see everything.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">When</th>
            <th className="px-4 py-2.5 font-medium">Who</th>
            <th className="px-4 py-2.5 font-medium">Action</th>
            <th className="px-4 py-2.5 font-medium">Entity</th>
            <th className="px-4 py-2.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({ row }: { row: AuditLogRow }) {
  const [open, setOpen] = useState(false)
  const detailsString = row.details ? JSON.stringify(row.details, null, 2) : null
  const hasDetails = !!detailsString && detailsString !== '{}'

  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
          {format(new Date(row.created_at), 'MMM d, yyyy HH:mm')}
        </td>
        <td className="px-4 py-2.5">
          <div className="text-sm text-foreground">
            {row.user_full_name || row.user_email || (
              <span className="text-muted-foreground italic">System</span>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {row.action}
          </Badge>
        </td>
        <td className="px-4 py-2.5">
          <div className="text-xs text-muted-foreground">
            {row.entity_type}
            {row.entity_id && (
              <>
                <br />
                <span className="font-mono text-[10px] opacity-70">{row.entity_id.slice(0, 8)}…</span>
              </>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          {row.message && <p className="text-xs text-foreground">{row.message}</p>}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {open ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {open ? 'Hide JSON' : 'Show JSON'}
            </button>
          )}
        </td>
      </tr>
      {open && hasDetails && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-4 py-3">
            <pre className="overflow-x-auto rounded-md bg-background p-3 text-[11px] leading-relaxed text-foreground">
              {detailsString}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

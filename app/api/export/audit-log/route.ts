import { NextRequest, NextResponse } from 'next/server'

import { listAuditLog } from '@/lib/actions/audit-log'
import { parseAuditLogFilter } from '@/lib/audit-log/filter'
import { csvCell } from '@/lib/csv'

export const dynamic = 'force-dynamic'

const EXPORT_LIMIT = 5000

// CSV export of the current audit-log filter (G-019). Honors the same URL
// params as `/settings/audit-log`. Owner+admin only (gating sits inside
// listAuditLog). Returns up to EXPORT_LIMIT rows in one shot — at HRHandle's
// scale that's "everything"; if it ever isn't, paginate the request and
// concatenate on the client.
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries())
  const filter = parseAuditLogFilter(params)

  const result = await listAuditLog(filter, 1, EXPORT_LIMIT)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  const csv = toCsv(result.data.rows)
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

interface AuditCsvRow {
  created_at: string
  user_full_name: string | null
  user_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  message: string | null
  details: Record<string, unknown> | null
}

function toCsv(rows: AuditCsvRow[]): string {
  const header = [
    'timestamp',
    'user_name',
    'user_email',
    'action',
    'entity_type',
    'entity_id',
    'message',
    'details_json',
  ].join(',')

  const escape = (v: string | null | undefined): string => csvCell(v)

  const body = rows
    .map((r) =>
      [
        escape(r.created_at),
        escape(r.user_full_name),
        escape(r.user_email),
        escape(r.action),
        escape(r.entity_type),
        escape(r.entity_id),
        escape(r.message),
        escape(r.details ? JSON.stringify(r.details) : null),
      ].join(','),
    )
    .join('\n')

  return `${header}\n${body}\n`
}

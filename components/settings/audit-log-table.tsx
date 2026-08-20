'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import type { AuditLogRow } from '@/lib/actions/audit-log'
import { auditEntityLabel, auditMessage } from '@/lib/audit-log/message-i18n'

interface AuditLogTableProps {
  rows: AuditLogRow[]
}

/** Deep-link an audit entry to the underlying record for incident review.
 * Only entity types with a real detail page are linkable; the rest stay text. */
function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null
  switch (entityType) {
    case 'candidate':
      return `/candidates/${entityId}`
    case 'vacancy':
      return `/vacancies/${entityId}`
    default:
      return null
  }
}

export function AuditLogTable({ rows }: AuditLogTableProps) {
  const t = useTranslations()
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium text-foreground">{t('auditTable.noActivity')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('auditTable.noActivityHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('auditTable.when')}</th>
            <th className="px-4 py-2.5 font-medium">{t('auditTable.who')}</th>
            <th className="px-4 py-2.5 font-medium">{t('auditFilters.action')}</th>
            <th className="px-4 py-2.5 font-medium">{t('auditTable.entity')}</th>
            <th className="px-4 py-2.5 font-medium">{t('auditTable.details')}</th>
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
  const t = useTranslations()

  return (
    <tr className="hover:bg-muted/30">
        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
          {format(new Date(row.created_at), 'dd.MM.yyyy HH:mm')}
        </td>
        <td className="px-4 py-2.5">
          <div className="text-sm text-foreground">
            {row.user_full_name || row.user_email || (
              <span className="text-muted-foreground italic">{t('auditTable.system')}</span>
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
            {auditEntityLabel(t, row.entity_type)}
            {row.entity_id && (
              <>
                <br />
                {(() => {
                  const href = entityHref(row.entity_type, row.entity_id)
                  const short = `${row.entity_id.slice(0, 8)}…`
                  return href ? (
                    <Link
                      href={href}
                      className="font-mono text-[10px] text-primary underline-offset-2 hover:underline"
                      title={t('auditTable.openRecord', { type: auditEntityLabel(t, row.entity_type) })}
                    >
                      {short}
                    </Link>
                  ) : (
                    <span className="font-mono text-[10px] opacity-70">{short}</span>
                  )
                })()}
              </>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <p className="text-xs text-foreground">{auditMessage(t, row)}</p>
        </td>
    </tr>
  )
}

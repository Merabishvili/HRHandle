'use server'

import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import type { AuditLogFilter } from '@/lib/audit-log/filter'

export interface AuditLogRow {
  id: string
  user_id: string | null
  user_full_name: string | null
  user_email: string | null
  entity_type: string
  entity_id: string | null
  action: string
  message: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const MAX_PAGE_SIZE = 100

/** Read the org's audit-log rows for the viewer UI (G-019). Owner+admin only —
 * non-admin members never see the page nor this action. RLS already scopes
 * activity_log to the user's org so the .eq('organization_id', …) is belt
 * + braces. Returns up to `pageSize` rows + a total count for the paginator. */
export async function listAuditLog(
  filter: AuditLogFilter,
  page: number,
  pageSize: number,
): Promise<
  ActionResult<{
    rows: AuditLogRow[]
    total: number
  }>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can view the audit log.' }
  }

  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE)
  const safePage = Math.max(1, Math.floor(page))
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = ctx.supabase
    .from('activity_log')
    .select('id, user_id, entity_type, entity_id, action, message, details, created_at', {
      count: 'exact',
    })
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false })

  if (filter.action) query = query.ilike('action', `%${filter.action}%`)
  if (filter.entityType) query = query.ilike('entity_type', `%${filter.entityType}%`)
  if (filter.userId) query = query.eq('user_id', filter.userId)
  if (filter.from) query = query.gte('created_at', `${filter.from}T00:00:00Z`)
  if (filter.to) query = query.lte('created_at', `${filter.to}T23:59:59.999Z`)

  const { data, error, count } = await query.range(from, to)
  if (error) {
    console.error('[audit-log] list failed:', error.message)
    return { success: false, error: 'Failed to load audit log' }
  }

  type Row = {
    id: string
    user_id: string | null
    entity_type: string
    entity_id: string | null
    action: string
    message: string | null
    details: Record<string, unknown> | null
    created_at: string
  }
  const rows = (data ?? []) as Row[]

  // Resolve user_ids → display names in a single follow-up. profiles has its
  // own RLS scoped to the same org, so this list is naturally constrained.
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)),
  )
  let nameById = new Map<string, { full_name: string | null; email: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    nameById = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
        (p) => [p.id, { full_name: p.full_name, email: p.email }],
      ),
    )
  }

  return {
    success: true,
    data: {
      rows: rows.map((r) => {
        const u = r.user_id ? nameById.get(r.user_id) : null
        return {
          id: r.id,
          user_id: r.user_id,
          user_full_name: u?.full_name ?? null,
          user_email: u?.email ?? null,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          action: r.action,
          message: r.message,
          details: r.details,
          created_at: r.created_at,
        }
      }),
      total: count ?? rows.length,
    },
  }
}

/** List the distinct profiles in the org, for the audit-log user filter
 * dropdown. Tiny list — orgs are small. */
export async function listOrgMembersForFilter(): Promise<
  ActionResult<{ id: string; full_name: string | null; email: string | null }[]>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Not authorized' }
  }

  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', ctx.orgId)
    .order('full_name', { ascending: true })

  if (error) return { success: false, error: 'Failed to load members' }

  return {
    success: true,
    data:
      (data ?? []) as { id: string; full_name: string | null; email: string | null }[],
  }
}

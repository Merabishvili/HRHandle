import { createAdminClient } from '@/lib/supabase/admin'

export interface AuditLogEntry {
  orgId: string
  userId: string | null
  entityType: string
  entityId: string | null
  action: string
  message?: string
  details?: Record<string, unknown>
}

/**
 * Records a compliance-relevant event in `public.activity_log`. Best-effort:
 * a write failure logs to stderr but never throws — call sites can fire-and-
 * forget without try/catch and without affecting their own success result.
 *
 * Uses the admin client so the write is not gated by RLS (the calling user
 * may not be able to read activity_log rows due to org policies, but writes
 * always need to land).
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('activity_log').insert({
      organization_id: entry.orgId,
      user_id: entry.userId,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      message: entry.message ?? null,
      details: entry.details ?? null,
    })
    if (error) {
      console.error('[audit-log] insert failed:', error.message, {
        entity: entry.entityType,
        action: entry.action,
      })
    }
  } catch (err) {
    console.error('[audit-log] unexpected error:', err)
  }
}

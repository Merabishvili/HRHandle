'use server'

import { revalidatePath } from 'next/cache'

import { getAuthContext, type ActionResult } from './index'
import { writeAuditLog } from '@/lib/audit-log'
import {
  isSavedViewKind,
  type SavedViewKind,
} from '@/lib/saved-views/list-kinds'
import {
  encodeParams,
  normalizeViewName,
  type EncodedParams,
} from '@/lib/saved-views/filter-encoding'

export interface SavedView {
  id: string
  list_kind: SavedViewKind
  name: string
  params: EncodedParams
  created_at: string
  updated_at: string
}

interface RawRow {
  id: string
  list_kind: string
  name: string
  params: unknown
  created_at: string
  updated_at: string
}

function toSavedView(row: RawRow): SavedView | null {
  if (!isSavedViewKind(row.list_kind)) return null
  const params: EncodedParams = {}
  if (row.params && typeof row.params === 'object' && !Array.isArray(row.params)) {
    for (const [k, v] of Object.entries(row.params as Record<string, unknown>)) {
      if (typeof v === 'string') params[k] = v
    }
  }
  return {
    id: row.id,
    list_kind: row.list_kind,
    name: row.name,
    params,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** List the current user's saved views for one list kind. Tiny list at
 * HRHandle's scale; no pagination. RLS scopes the read to the caller. */
export async function listSavedViews(
  kind: SavedViewKind,
): Promise<ActionResult<SavedView[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isSavedViewKind(kind)) return { success: false, error: 'Invalid list kind' }

  const { data, error } = await ctx.supabase
    .from('saved_views')
    .select('id, list_kind, name, params, created_at, updated_at')
    .eq('user_id', ctx.userId)
    .eq('list_kind', kind)
    .order('name', { ascending: true })

  if (error) {
    console.error('[saved-views] list failed:', error.message)
    return { success: false, error: 'Failed to load saved views' }
  }

  const views = ((data ?? []) as RawRow[])
    .map(toSavedView)
    .filter((v): v is SavedView => v !== null)
  return { success: true, data: views }
}

/** Save the current filter combination under a new name. The
 * (user_id, list_kind, name) UNIQUE index produces a friendly error on
 * conflict. */
export async function saveView(
  kind: SavedViewKind,
  rawName: string,
  rawParams: Record<string, string | null | undefined>,
): Promise<ActionResult<SavedView>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isSavedViewKind(kind)) return { success: false, error: 'Invalid list kind' }

  const name = normalizeViewName(rawName)
  if (!name) {
    return { success: false, error: 'Give the view a name between 1 and 60 characters.' }
  }
  const params = encodeParams(kind, rawParams)

  const { data, error } = await ctx.supabase
    .from('saved_views')
    .insert({
      organization_id: ctx.orgId,
      user_id: ctx.userId,
      list_kind: kind,
      name,
      params,
    })
    .select('id, list_kind, name, params, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `You already have a view named "${name}".` }
    }
    console.error('[saved-views] insert failed:', error.message)
    return { success: false, error: 'Failed to save view' }
  }

  const view = toSavedView(data as RawRow)
  if (!view) return { success: false, error: 'Saved view returned in unexpected shape' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'saved_view',
    entityId: view.id,
    action: 'saved_view_created',
    message: `${kind} view created`,
    details: { kind, name: view.name },
  })

  revalidatePath(`/${kind}`)
  return { success: true, data: view }
}

/** Overwrite the params on an existing view (typically called after the
 * recruiter tweaks filters from a loaded view + clicks "Update"). The
 * view's name + kind are preserved. RLS guarantees only the owner can
 * touch this row. */
export async function updateViewParams(
  id: string,
  rawParams: Record<string, string | null | undefined>,
): Promise<ActionResult<SavedView>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: existing } = await ctx.supabase
    .from('saved_views')
    .select('list_kind')
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .single()
  if (!existing) return { success: false, error: 'View not found' }
  if (!isSavedViewKind(existing.list_kind)) {
    return { success: false, error: 'View has an unknown list kind' }
  }

  const params = encodeParams(existing.list_kind, rawParams)
  const { data, error } = await ctx.supabase
    .from('saved_views')
    .update({ params, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .select('id, list_kind, name, params, created_at, updated_at')
    .single()

  if (error) {
    console.error('[saved-views] update failed:', error.message)
    return { success: false, error: 'Failed to update view' }
  }

  const view = toSavedView(data as RawRow)
  if (!view) return { success: false, error: 'Saved view returned in unexpected shape' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'saved_view',
    entityId: view.id,
    action: 'saved_view_updated',
    message: `${view.list_kind} view updated`,
    details: { kind: view.list_kind, name: view.name },
  })

  revalidatePath(`/${view.list_kind}`)
  return { success: true, data: view }
}

export async function renameView(
  id: string,
  rawName: string,
): Promise<ActionResult<SavedView>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const name = normalizeViewName(rawName)
  if (!name) {
    return { success: false, error: 'Give the view a name between 1 and 60 characters.' }
  }

  const { data, error } = await ctx.supabase
    .from('saved_views')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .select('id, list_kind, name, params, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `You already have a view named "${name}".` }
    }
    console.error('[saved-views] rename failed:', error.message)
    return { success: false, error: 'Failed to rename view' }
  }

  const view = toSavedView(data as RawRow)
  if (!view) return { success: false, error: 'Saved view returned in unexpected shape' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'saved_view',
    entityId: view.id,
    action: 'saved_view_renamed',
    message: `${view.list_kind} view renamed`,
    details: { kind: view.list_kind, name: view.name },
  })

  revalidatePath(`/${view.list_kind}`)
  return { success: true, data: view }
}

export async function deleteView(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: existing } = await ctx.supabase
    .from('saved_views')
    .select('id, list_kind, name')
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .single()
  if (!existing) return { success: false, error: 'View not found' }

  const { error } = await ctx.supabase
    .from('saved_views')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId)
  if (error) {
    console.error('[saved-views] delete failed:', error.message)
    return { success: false, error: 'Failed to delete view' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'saved_view',
    entityId: id,
    action: 'saved_view_deleted',
    message: `${existing.list_kind} view deleted`,
    details: { kind: existing.list_kind, name: existing.name },
  })

  if (isSavedViewKind(existing.list_kind as string)) {
    revalidatePath(`/${existing.list_kind}`)
  }
  return { success: true, data: undefined }
}

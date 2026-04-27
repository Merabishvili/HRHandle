'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export interface RejectionReason {
  id: string
  name: string
  send_email: boolean
  sort_order: number
}

const MAX_REASONS = 50

export async function getRejectionReasons(): Promise<ActionResult<RejectionReason[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('rejection_reasons')
    .select('id, name, send_email, sort_order')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as RejectionReason[] }
}

export async function createRejectionReason(
  name: string,
  sendEmail: boolean
): Promise<ActionResult<RejectionReason>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection reasons.' }
  }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required.' }

  const { count } = await ctx.supabase
    .from('rejection_reasons')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)

  if ((count ?? 0) >= MAX_REASONS) {
    return { success: false, error: `Maximum ${MAX_REASONS} rejection reasons allowed.` }
  }

  const { data, error } = await ctx.supabase
    .from('rejection_reasons')
    .insert({
      organization_id: ctx.orgId,
      name: trimmed,
      send_email: sendEmail,
      sort_order: count ?? 0,
    })
    .select('id, name, send_email, sort_order')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: data as RejectionReason }
}

export async function updateRejectionReason(
  id: string,
  name: string,
  sendEmail: boolean
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection reasons.' }
  }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required.' }

  const { error } = await ctx.supabase
    .from('rejection_reasons')
    .update({ name: trimmed, send_email: sendEmail })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: undefined }
}

export async function deleteRejectionReason(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection reasons.' }
  }

  const { error } = await ctx.supabase
    .from('rejection_reasons')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: undefined }
}

'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
export interface RejectionTemplate {
  id: string
  name: string
  subject: string
  body: string
  sort_order: number
}

const MAX_TEMPLATES = 20

export async function getRejectionTemplates(): Promise<ActionResult<RejectionTemplate[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('rejection_templates')
    .select('id, name, subject, body, sort_order')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data as RejectionTemplate[] }
}

export async function createRejectionTemplate(
  name: string,
  subject: string,
  body: string
): Promise<ActionResult<RejectionTemplate>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }

  const { count } = await ctx.supabase
    .from('rejection_templates')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)

  if ((count ?? 0) >= MAX_TEMPLATES) {
    return { success: false, error: `Maximum ${MAX_TEMPLATES} rejection templates allowed.` }
  }

  const { data, error } = await ctx.supabase
    .from('rejection_templates')
    .insert({
      organization_id: ctx.orgId,
      name: trimName,
      subject: trimSubject,
      body: trimBody,
      sort_order: count ?? 0,
    })
    .select('id, name, subject, body, sort_order')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: data as RejectionTemplate }
}

export async function updateRejectionTemplate(
  id: string,
  name: string,
  subject: string,
  body: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .update({ name: trimName, subject: trimSubject, body: trimBody, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: undefined }
}

export async function deleteRejectionTemplate(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/rejection-reasons')
  return { success: true, data: undefined }
}

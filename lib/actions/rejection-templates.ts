'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
export interface RejectionTemplate {
  id: string
  name: string
  subject: string
  body: string
  sort_order: number
  reason_id: string | null
}

const MAX_TEMPLATES = 20

export async function getRejectionTemplates(): Promise<ActionResult<RejectionTemplate[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('rejection_templates')
    .select('id, name, subject, body, sort_order, reason_id')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: 'Operation failed. Please try again.' }
  return { success: true, data: data as RejectionTemplate[] }
}

export async function createRejectionTemplate(
  name: string,
  subject: string,
  body: string,
  reasonId: string | null
): Promise<ActionResult<RejectionTemplate>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (trimName.length > 200) return { success: false, error: 'Template name must be 200 characters or fewer.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (trimSubject.length > 500) return { success: false, error: 'Subject must be 500 characters or fewer.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }
  if (trimBody.length > 10000) return { success: false, error: 'Message body must be 10,000 characters or fewer.' }

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
      reason_id: reasonId ?? null,
    })
    .select('id, name, subject, body, sort_order, reason_id')
    .single()

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: data as RejectionTemplate }
}

export async function updateRejectionTemplate(
  id: string,
  name: string,
  subject: string,
  body: string,
  reasonId: string | null
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (trimName.length > 200) return { success: false, error: 'Template name must be 200 characters or fewer.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (trimSubject.length > 500) return { success: false, error: 'Subject must be 500 characters or fewer.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }
  if (trimBody.length > 10000) return { success: false, error: 'Message body must be 10,000 characters or fewer.' }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .update({
      name: trimName,
      subject: trimSubject,
      body: trimBody,
      reason_id: reasonId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

export async function deleteRejectionTemplate(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

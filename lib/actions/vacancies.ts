'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { VacancySchema, type VacancyInput } from '@/lib/validations/vacancy'

export async function createVacancy(input: VacancyInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const limitError = await checkPlanLimit(ctx, 'vacancy')
  if (limitError) return { success: false, error: limitError }

  const parsed = VacancySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { data, error } = await ctx.supabase
    .from('vacancies')
    .insert({
      ...parsed.data,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to create vacancy' }

  revalidatePath('/vacancies')
  return { success: true, data: { id: data.id } }
}

export async function updateVacancy(
  id: string,
  input: VacancyInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = VacancySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update vacancy' }

  revalidatePath('/vacancies')
  revalidatePath(`/vacancies/${id}`)
  return { success: true, data: undefined }
}

export async function updateVacancyStatus(
  id: string,
  statusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ status_id: statusId })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update vacancy status' }

  revalidatePath('/vacancies')
  revalidatePath(`/vacancies/${id}`)
  return { success: true, data: undefined }
}

export async function deleteVacancy(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete vacancy' }

  revalidatePath('/vacancies')
  return { success: true, data: undefined }
}

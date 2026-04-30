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

  const tokenForInsert = parsed.data.show_on_public_page
    ? Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    : undefined

  const { data, error } = await ctx.supabase
    .from('vacancies')
    .insert({
      ...parsed.data,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      ...(tokenForInsert ? { application_form_token: tokenForInsert } : {}),
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

  const updatePayload: Record<string, unknown> = { ...parsed.data }

  // Auto-generate application_form_token when show_on_public_page is being enabled
  if (parsed.data.show_on_public_page) {
    const { data: existing } = await ctx.supabase
      .from('vacancies')
      .select('application_form_token')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .single()

    if (!existing?.application_form_token) {
      updatePayload.application_form_token = Buffer.from(
        crypto.getRandomValues(new Uint8Array(32))
      ).toString('base64url')
    }
  }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

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
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update vacancy status' }

  revalidatePath('/vacancies')
  revalidatePath(`/vacancies/${id}`)
  return { success: true, data: undefined }
}

export async function duplicateVacancy(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const limitError = await checkPlanLimit(ctx, 'vacancy')
  if (limitError) return { success: false, error: limitError }

  const { data: orig } = await ctx.supabase
    .from('vacancies')
    .select('title, sector_id, status_id, department, location, employment_type, hiring_manager_name, salary_min, salary_max, salary_currency, openings_count, start_date, end_date, description, responsibilities, requirements')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!orig) return { success: false, error: 'Vacancy not found' }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  let newEndDate: string | null = null
  if (orig.end_date && orig.start_date) {
    const diffDays = Math.round(
      (new Date(orig.end_date).getTime() - new Date(orig.start_date).getTime()) / 86_400_000
    )
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + diffDays)
    newEndDate = endDate.toISOString().split('T')[0]
  }

  const { data: draftStatus } = await ctx.supabase
    .from('vacancy_statuses')
    .select('id')
    .eq('code', 'draft')
    .single()

  const { data: newVacancy, error: vacancyError } = await ctx.supabase
    .from('vacancies')
    .insert({
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      title: orig.title,
      sector_id: orig.sector_id,
      status_id: draftStatus?.id ?? orig.status_id,
      department: orig.department,
      location: orig.location,
      employment_type: orig.employment_type,
      hiring_manager_name: orig.hiring_manager_name,
      salary_min: orig.salary_min,
      salary_max: orig.salary_max,
      salary_currency: orig.salary_currency,
      openings_count: orig.openings_count,
      start_date: todayStr,
      end_date: newEndDate,
      description: orig.description,
      responsibilities: orig.responsibilities,
      requirements: orig.requirements,
      show_on_public_page: false,
      application_form_token: null,
    })
    .select('id')
    .single()

  if (vacancyError || !newVacancy) return { success: false, error: 'Failed to duplicate vacancy' }

  // Copy assessment questions
  const { data: questions } = await ctx.supabase
    .from('vacancy_questions')
    .select('label, type, sort_order')
    .eq('vacancy_id', id)
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })

  if (questions && questions.length > 0) {
    await ctx.supabase.from('vacancy_questions').insert(
      questions.map((q) => ({
        vacancy_id: newVacancy.id,
        organization_id: ctx.orgId,
        label: q.label,
        type: q.type,
        sort_order: q.sort_order,
      }))
    )
  }

  // Copy custom field values
  const { data: cfValues } = await ctx.supabase
    .from('custom_field_values')
    .select('field_id, value_text, value_number, value_boolean, value_option')
    .eq('entity_id', id)
    .eq('organization_id', ctx.orgId)

  if (cfValues && cfValues.length > 0) {
    await ctx.supabase.from('custom_field_values').insert(
      cfValues.map((v) => ({
        organization_id: ctx.orgId,
        entity_id: newVacancy.id,
        field_id: v.field_id,
        value_text: v.value_text,
        value_number: v.value_number,
        value_boolean: v.value_boolean,
        value_option: v.value_option,
      }))
    )
  }

  revalidatePath('/vacancies')
  return { success: true, data: { id: newVacancy.id } }
}

export async function deleteVacancy(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to delete vacancy' }

  revalidatePath('/vacancies')
  return { success: true, data: undefined }
}

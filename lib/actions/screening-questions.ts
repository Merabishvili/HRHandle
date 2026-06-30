'use server'

import { revalidatePath } from 'next/cache'

import { getAuthContext, type ActionResult } from './index'
import { normalizeScreeningQuestionEntries } from '@/lib/screening-questions/normalize'
import type { KnockoutCondition } from '@/lib/screening-questions/knockout-condition'

export interface ScreeningQuestionRow {
  id: string
  vacancy_id: string
  label: string
  answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
  options: string[] | null
  is_knockout: boolean
  knockout_answer: string | null
  sort_order: number
}

/**
 * Wave 2.5 Slice 2a — bulk-create the screening questions captured by
 * Step 4 of the vacancy create wizard. Sort order starts after whatever
 * already exists on the vacancy so re-running the wizard from a draft
 * doesn't reorder previously-added rows.
 *
 * Only owners/admins can write. Same permission model as
 * `addVacancyQuestion` / `bulkCreateVacancyQuestions`.
 */
export async function bulkCreateScreeningQuestions(
  vacancyId: string,
  entries: {
    label: string
    knockout?: boolean
    answerType?: 'yes_no' | 'short_text' | 'number' | 'select'
    options?: string[]
    knockoutCondition?: KnockoutCondition | null
  }[],
): Promise<ActionResult<{ inserted: number }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', ctx.userId)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { success: false, error: 'Not authorized' }
  }

  const { data: vacancyCheck } = await ctx.supabase
    .from('vacancies')
    .select('id')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!vacancyCheck) return { success: false, error: 'Vacancy not found' }

  const normalized = normalizeScreeningQuestionEntries(entries)
  if (normalized.length === 0) return { success: true, data: { inserted: 0 } }

  const { data: existing } = await ctx.supabase
    .from('vacancy_screening_questions')
    .select('sort_order')
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const startSort = (existing?.[0]?.sort_order ?? -1) + 1

  const rows = normalized.map((e, idx) => ({
    vacancy_id: vacancyId,
    organization_id: ctx.orgId,
    label: e.label,
    answer_type: e.answer_type,
    is_knockout: e.is_knockout,
    knockout_answer: e.knockout_answer,
    options: e.options,
    sort_order: startSort + idx,
  }))

  const { error } = await ctx.supabase.from('vacancy_screening_questions').insert(rows)
  if (error) return { success: false, error: 'Failed to save screening questions' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: { inserted: rows.length } }
}

/** Read all screening questions for a vacancy, ordered by sort_order. Used
 * by the vacancy detail Scorecard tab. RLS keeps it org-scoped. */
export async function listScreeningQuestionsForVacancy(
  vacancyId: string,
): Promise<ActionResult<ScreeningQuestionRow[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('vacancy_screening_questions')
    .select('id, vacancy_id, label, answer_type, options, is_knockout, knockout_answer, sort_order')
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })

  if (error) return { success: false, error: 'Failed to load screening questions' }
  return { success: true, data: (data ?? []) as ScreeningQuestionRow[] }
}

/** Owner/admin-only delete. The apply-form integration in Slice 2b will
 * also cascade-delete any answers via the FK ON DELETE CASCADE in the
 * migration. */
export async function deleteScreeningQuestion(
  questionId: string,
  vacancyId: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', ctx.userId)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { success: false, error: 'Not authorized' }
  }

  const { error } = await ctx.supabase
    .from('vacancy_screening_questions')
    .delete()
    .eq('id', questionId)
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to remove screening question' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: undefined }
}

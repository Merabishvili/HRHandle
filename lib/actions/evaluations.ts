'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export async function addVacancyQuestion(
  vacancyId: string,
  label: string,
  type: 'text' | 'score'
): Promise<ActionResult<{ id: string }>> {
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

  const { data: existing } = await ctx.supabase
    .from('vacancy_questions')
    .select('sort_order')
    .eq('vacancy_id', vacancyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await ctx.supabase
    .from('vacancy_questions')
    .insert({
      vacancy_id: vacancyId,
      organization_id: ctx.orgId,
      label: label.trim(),
      type,
      sort_order: nextSortOrder,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to add question' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: { id: data.id } }
}

export async function removeVacancyQuestion(
  questionId: string,
  vacancyId: string
): Promise<ActionResult<null>> {
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
    .from('vacancy_questions')
    .delete()
    .eq('id', questionId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to remove question' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: null }
}

export async function saveEvaluation(input: {
  applicationId: string
  vacancyId: string
  candidateId: string
  score: number | null
  answers: { questionId: string; textValue: string | null; scoreValue: number | null }[]
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: evaluation, error: evalError } = await ctx.supabase
    .from('candidate_evaluations')
    .upsert(
      {
        application_id: input.applicationId,
        vacancy_id: input.vacancyId,
        candidate_id: input.candidateId,
        organization_id: ctx.orgId,
        score: input.score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'application_id' }
    )
    .select('id')
    .single()

  if (evalError || !evaluation) return { success: false, error: 'Failed to save evaluation' }

  if (input.answers.length > 0) {
    const rows = input.answers.map((a) => ({
      evaluation_id: evaluation.id,
      question_id: a.questionId,
      organization_id: ctx.orgId,
      text_value: a.textValue ?? null,
      score_value: a.scoreValue ?? null,
      updated_at: new Date().toISOString(),
    }))

    const { error: answersError } = await ctx.supabase
      .from('candidate_evaluation_answers')
      .upsert(rows, { onConflict: 'evaluation_id,question_id' })

    if (answersError) return { success: false, error: 'Failed to save answers' }
  }

  revalidatePath(`/candidates/${input.candidateId}`)
  return { success: true, data: { id: evaluation.id } }
}

'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { normalizeVacancyQuestionEntries } from '@/lib/vacancy-questions/normalize'

export async function addVacancyQuestion(
  vacancyId: string,
  label: string,
  type: 'text' | 'score',
  mustHave: boolean = false,
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

  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { success: false, error: 'Question label is required' }
  if (trimmedLabel.length > 500) return { success: false, error: 'Question label must be 500 characters or fewer' }

  const { data: vacancyCheck } = await ctx.supabase
    .from('vacancies')
    .select('id')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!vacancyCheck) return { success: false, error: 'Vacancy not found' }

  const { data: existing } = await ctx.supabase
    .from('vacancy_questions')
    .select('sort_order')
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await ctx.supabase
    .from('vacancy_questions')
    .insert({
      vacancy_id: vacancyId,
      organization_id: ctx.orgId,
      label: trimmedLabel,
      type,
      sort_order: nextSortOrder,
      // must_have only meaningful for score-type attributes. Text-type
      // open questions stay false regardless of what the caller passed
      // so the UI never shows a star on an open-question card.
      must_have: type === 'score' && mustHave,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to add question' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: { id: data.id } }
}

/**
 * Wave 2.5 — bulk insert scorecard attributes from the create-vacancy
 * wizard's Step 4. Skips entries with blank labels and stamps sort_order
 * sequentially from whatever already exists on the vacancy, so re-running
 * after a partial save doesn't reorder previously-added rows. Returns
 * `{ inserted }` so the wizard can surface "Added N attributes" toasts.
 */
export async function bulkCreateVacancyQuestions(
  vacancyId: string,
  entries: { label: string; type: 'text' | 'score'; mustHave?: boolean }[],
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

  const normalized = normalizeVacancyQuestionEntries(entries)
  if (normalized.length === 0) return { success: true, data: { inserted: 0 } }

  const { data: existing } = await ctx.supabase
    .from('vacancy_questions')
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
    type: e.type,
    sort_order: startSort + idx,
    must_have: e.mustHave,
  }))

  const { error } = await ctx.supabase.from('vacancy_questions').insert(rows)
  if (error) return { success: false, error: 'Failed to save scorecard attributes' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: { inserted: rows.length } }
}

/**
 * Wave 2.5 — toggle the must-have flag on a single scorecard attribute.
 * Type-text questions never carry a must_have semantic, so callers
 * targeting one get a noop-success response.
 */
export async function toggleVacancyQuestionMustHave(
  questionId: string,
  vacancyId: string,
  mustHave: boolean,
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

  const { data: existing } = await ctx.supabase
    .from('vacancy_questions')
    .select('id, type')
    .eq('id', questionId)
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!existing) return { success: false, error: 'Question not found' }
  if (existing.type !== 'score') return { success: true, data: undefined }

  const { error } = await ctx.supabase
    .from('vacancy_questions')
    .update({ must_have: mustHave })
    .eq('id', questionId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update attribute' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: undefined }
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
  /** Binary advance-or-reject recommendation (the 4-way UI Strong yes / Yes /
   * Lean no / No maps down to this — the DB column is constrained to yes|no).
   * Omit to leave the existing recommendation untouched. */
  recommendation?: 'yes' | 'no' | null
  recommendationReason?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Verify the application belongs to this org before upserting
  const { data: appCheck } = await ctx.supabase
    .from('applications')
    .select('id')
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!appCheck) return { success: false, error: 'Application not found' }

  const { data: evaluation, error: evalError } = await ctx.supabase
    .from('candidate_evaluations')
    .upsert(
      {
        application_id: input.applicationId,
        vacancy_id: input.vacancyId,
        candidate_id: input.candidateId,
        organization_id: ctx.orgId,
        score: input.score,
        ...(input.recommendation !== undefined ? { recommendation: input.recommendation } : {}),
        ...(input.recommendationReason !== undefined
          ? { recommendation_reason: input.recommendationReason }
          : {}),
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

export interface ScorecardQuestion {
  id: string
  label: string
  type: 'text' | 'score'
  mustHave: boolean
}

export interface ScorecardData {
  vacancyId: string
  vacancyTitle: string
  candidateId: string
  questions: ScorecardQuestion[]
  existing: {
    score: number | null
    recommendation: 'yes' | 'no' | null
    recommendationReason: string | null
    answers: { questionId: string; textValue: string | null; scoreValue: number | null }[]
  } | null
}

/**
 * Lazy-load everything the in-place "Score candidate" modal needs for one
 * application: the vacancy's real scorecard attributes + interview-guide
 * questions (the SETUP defined on the vacancy) plus this reviewer's existing
 * evaluation to prefill. Keeps the candidate profile page lean — only fetched
 * when the recruiter opens the modal.
 */
export async function getScorecardData(
  applicationId: string,
): Promise<ActionResult<ScorecardData>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: app } = await ctx.supabase
    .from('applications')
    .select('id, vacancy_id, candidate_id, vacancies ( title )')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!app) return { success: false, error: 'Application not found' }

  const vacancyJoin = app.vacancies as { title: string } | { title: string }[] | null
  const vacancyRow = Array.isArray(vacancyJoin) ? vacancyJoin[0] : vacancyJoin

  const { data: questionRows } = await ctx.supabase
    .from('vacancy_questions')
    .select('id, label, type, must_have, sort_order')
    .eq('vacancy_id', app.vacancy_id)
    .order('sort_order', { ascending: true })

  const questions: ScorecardQuestion[] = (
    (questionRows ?? []) as {
      id: string
      label: string
      type: 'text' | 'score'
      must_have: boolean
    }[]
  ).map((q) => ({ id: q.id, label: q.label, type: q.type, mustHave: !!q.must_have }))

  const { data: evalRow } = await ctx.supabase
    .from('candidate_evaluations')
    .select('id, score, recommendation, recommendation_reason')
    .eq('application_id', applicationId)
    .maybeSingle()

  let existing: ScorecardData['existing'] = null
  if (evalRow) {
    const { data: answerRows } = await ctx.supabase
      .from('candidate_evaluation_answers')
      .select('question_id, text_value, score_value')
      .eq('evaluation_id', evalRow.id)

    existing = {
      score: (evalRow.score as number | null) ?? null,
      recommendation: (evalRow.recommendation as 'yes' | 'no' | null) ?? null,
      recommendationReason: (evalRow.recommendation_reason as string | null) ?? null,
      answers: ((answerRows ?? []) as {
        question_id: string
        text_value: string | null
        score_value: number | null
      }[]).map((a) => ({
        questionId: a.question_id,
        textValue: a.text_value,
        scoreValue: a.score_value,
      })),
    }
  }

  return {
    success: true,
    data: {
      vacancyId: app.vacancy_id,
      vacancyTitle: vacancyRow?.title ?? 'this role',
      candidateId: app.candidate_id,
      questions,
      existing,
    },
  }
}

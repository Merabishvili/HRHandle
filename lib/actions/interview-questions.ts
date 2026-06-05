'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthContext, type ActionResult } from './index'
import { writeAuditLog } from '@/lib/audit-log'
import {
  INTERVIEW_QUESTION_CATEGORIES,
  type InterviewQuestionsSet,
} from '@/lib/ai/interview-questions'

/**
 * Set / clear the saved interview questions for a vacancy. Pass `null` to
 * clear, or a complete InterviewQuestionsSet to replace.
 *
 * Authorisation: any active member of the vacancy's organisation (owner,
 * admin, member) can save. Matches the existing pattern on other vacancy
 * actions — there's no per-role permission gate on saving role-level data.
 *
 * Writes an audit log row. The category names + counts are stored in the
 * audit log, but the question content is NOT — keeps the audit log
 * lightweight and avoids duplicating content already in the JSONB column.
 */

const QuestionsSchema = z
  .object({
    behavioural: z.array(z.string().min(1).max(500)).max(20),
    technical: z.array(z.string().min(1).max(500)).max(20),
    situational: z.array(z.string().min(1).max(500)).max(20),
    closing: z.array(z.string().min(1).max(500)).max(20),
  })
  .nullable()

export async function setInterviewQuestions(
  vacancyId: string,
  questions: InterviewQuestionsSet | null,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = QuestionsSchema.safeParse(questions)
  if (!parsed.success) {
    return { success: false, error: 'Invalid question set' }
  }

  // Verify the vacancy belongs to the user's org (RLS would also block, but
  // a clean error message is better than a silent zero-update).
  const { data: vacancy } = await ctx.supabase
    .from('vacancies')
    .select('id')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!vacancy) return { success: false, error: 'Vacancy not found' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ interview_questions: parsed.data })
    .eq('id', vacancyId)

  if (error) {
    console.error('[setInterviewQuestions] update failed:', error.message)
    return { success: false, error: 'Failed to save questions' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: vacancyId,
    action: parsed.data === null ? 'cleared' : 'updated',
    message:
      parsed.data === null
        ? 'Interview questions cleared'
        : 'Interview questions saved',
    details:
      parsed.data === null
        ? { field: 'interview_questions' }
        : {
            field: 'interview_questions',
            counts: Object.fromEntries(
              INTERVIEW_QUESTION_CATEGORIES.map((c) => [c, parsed.data![c].length]),
            ),
          },
  })

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: undefined }
}

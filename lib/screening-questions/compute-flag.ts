/**
 * Wave 2.5 Slice 2b — pure knockout-flag computation for screening answers.
 * Pulled out of the apply-form submit path so it can be unit-tested without
 * spinning up Supabase.
 *
 * Semantics:
 *   - `is_knockout=false` → informational; never flags.
 *   - `is_knockout=true` → the answer must satisfy the question's passing
 *     CONDITION (encoded in `knockout_answer`, interpreted per `answer_type`
 *     — see knockout-condition.ts) to NOT flag. A failing or missing answer
 *     flags. Number questions can be knockouts (ranges); select questions can
 *     pass on any of several options.
 *   - `is_knockout=true` but `knockout_answer` null (defensive — a bad row):
 *     don't flag. Better to under-flag than to noise the recruiter's view.
 */
import {
  evaluateKnockoutPass,
  type ScreeningAnswerType,
} from './knockout-condition'

export interface KnockoutQuestion {
  is_knockout: boolean
  knockout_answer: string | null
  /** Defaults to yes_no for legacy callers that didn't store a type. */
  answer_type?: ScreeningAnswerType
}

export function computeIsKnockoutFlag(
  question: KnockoutQuestion,
  answerValue: string | null | undefined,
): boolean {
  if (!question.is_knockout) return false
  if (!question.knockout_answer) return false
  return !evaluateKnockoutPass(
    question.answer_type ?? 'yes_no',
    question.knockout_answer,
    answerValue,
  )
}

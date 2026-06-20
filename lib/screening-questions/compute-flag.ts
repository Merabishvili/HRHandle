/**
 * Wave 2.5 Slice 2b — pure knockout-flag computation for screening
 * answers. Pulled out of the apply-form submit path so it can be unit-
 * tested without spinning up Supabase.
 *
 * Semantics (matches the design's "Knockout · must = Yes" example):
 *   - When `is_knockout=false`, the question is informational — flag is
 *     never set regardless of answer.
 *   - When `is_knockout=true`, the answer must case-insensitively match
 *     `knockout_answer` to NOT flag. Any other answer flags. An empty /
 *     missing answer also flags (the recruiter should know the candidate
 *     skipped a knockout question).
 *   - If `is_knockout=true` but `knockout_answer` is null (defensive — a
 *     bad row), we don't flag. Better to under-flag than to noise the
 *     recruiter's screening view.
 */
export interface KnockoutQuestion {
  is_knockout: boolean
  knockout_answer: string | null
}

export function computeIsKnockoutFlag(
  question: KnockoutQuestion,
  answerValue: string | null | undefined,
): boolean {
  if (!question.is_knockout) return false
  if (!question.knockout_answer) return false
  const expected = question.knockout_answer.trim().toLowerCase()
  if (answerValue === null || answerValue === undefined) return true
  const got = answerValue.trim().toLowerCase()
  if (!got) return true
  return got !== expected
}

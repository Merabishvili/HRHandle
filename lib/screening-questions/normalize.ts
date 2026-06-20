/**
 * Pure normalization for the screening-questions bulk-insert path. Sits
 * next to vacancy-questions/normalize.ts so both wizard Step 4 lists
 * have the same testable shape.
 *
 * Inputs from the wizard:
 *   - `label`: free text the recruiter typed.
 *   - `knockout`: boolean toggle on each row.
 *
 * Wave 2.5 Slice 2a only writes `yes_no` rows (the UI doesn't capture an
 * answer-type yet). When `knockout=true` we default `knockout_answer` to
 * `'yes'`, matching the design's "must = Yes" example — Slice 2b's
 * apply-form work can extend the wizard to other answer types without
 * needing a schema change.
 *
 * Rules:
 *   - Trim labels; drop entries whose trimmed label is empty.
 *   - Drop entries whose trimmed label exceeds 500 chars (same ceiling
 *     as `vacancy_questions.label`).
 *   - When `knockout=false`, `knockout_answer` is null.
 */
export interface NormalizedScreeningEntry {
  label: string
  answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
  is_knockout: boolean
  knockout_answer: string | null
}

export function normalizeScreeningQuestionEntries(
  entries: { label: string; knockout?: boolean }[],
): NormalizedScreeningEntry[] {
  return entries
    .map((e) => {
      const trimmed = e.label.trim()
      const isKnockout = Boolean(e.knockout)
      return {
        label: trimmed,
        answer_type: 'yes_no' as const,
        is_knockout: isKnockout,
        knockout_answer: isKnockout ? 'yes' : null,
      }
    })
    .filter((e) => e.label.length > 0 && e.label.length <= 500)
}

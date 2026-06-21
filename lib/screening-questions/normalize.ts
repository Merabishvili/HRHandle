/**
 * Pure normalization for the screening-questions bulk-insert path. Sits
 * next to vacancy-questions/normalize.ts so both wizard Step 4 lists
 * have the same testable shape.
 *
 * Inputs from the wizard:
 *   - `label`: free text the recruiter typed.
 *   - `answerType`: 'yes_no' | 'short_text' | 'number' | 'select'.
 *     Defaults to `yes_no` when omitted (compat with older callers).
 *   - `knockout`: boolean toggle. Only meaningful for `yes_no` and
 *     `select` — `short_text` and `number` always normalize to
 *     informational because there's no canonical knockout-answer to
 *     compare against.
 *   - `options`: array of option strings, only relevant when
 *     `answerType === 'select'`.
 *
 * Rules (tested in lib/__tests__/screening-questions-normalize.test.ts):
 *   - Trim labels; drop entries whose trimmed label is empty.
 *   - Drop entries whose trimmed label exceeds 500 chars.
 *   - `yes_no`: when knockout, set `knockout_answer = 'yes'` (the
 *     design's "must = Yes" example). Non-knockout → null.
 *   - `select`: each option is trimmed; empty options dropped. Drop the
 *     whole entry if no options remain. When knockout, the first
 *     option becomes the expected answer (`must = ${options[0]}`).
 *   - `short_text` / `number`: force `is_knockout = false` and
 *     `knockout_answer = null`. No options either.
 */
export type ScreeningAnswerType = 'yes_no' | 'short_text' | 'number' | 'select'

export interface NormalizedScreeningEntry {
  label: string
  answer_type: ScreeningAnswerType
  is_knockout: boolean
  knockout_answer: string | null
  /** Cleaned option list for select-type entries; null for others. */
  options: string[] | null
}

export interface ScreeningEntryInput {
  label: string
  answerType?: ScreeningAnswerType
  knockout?: boolean
  options?: string[]
}

export function normalizeScreeningQuestionEntries(
  entries: ScreeningEntryInput[],
): NormalizedScreeningEntry[] {
  const out: NormalizedScreeningEntry[] = []

  for (const e of entries) {
    const label = e.label.trim()
    if (!label || label.length > 500) continue

    const answerType: ScreeningAnswerType = e.answerType ?? 'yes_no'
    const knockoutFlag = Boolean(e.knockout)

    if (answerType === 'short_text' || answerType === 'number') {
      out.push({
        label,
        answer_type: answerType,
        is_knockout: false,
        knockout_answer: null,
        options: null,
      })
      continue
    }

    if (answerType === 'yes_no') {
      out.push({
        label,
        answer_type: 'yes_no',
        is_knockout: knockoutFlag,
        knockout_answer: knockoutFlag ? 'yes' : null,
        options: null,
      })
      continue
    }

    // select
    const cleanedOptions = (e.options ?? [])
      .map((o) => o.trim())
      .filter((o) => o.length > 0 && o.length <= 200)
    if (cleanedOptions.length === 0) continue

    out.push({
      label,
      answer_type: 'select',
      is_knockout: knockoutFlag,
      knockout_answer: knockoutFlag ? cleanedOptions[0] ?? null : null,
      options: cleanedOptions,
    })
  }

  return out
}

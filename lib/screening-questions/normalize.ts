/**
 * Pure normalization for the screening-questions bulk-insert path. Sits
 * next to vacancy-questions/normalize.ts so both wizard Step 4 lists
 * have the same testable shape.
 *
 * Inputs from the wizard:
 *   - `label`: free text the recruiter typed.
 *   - `answerType`: 'yes_no' | 'short_text' | 'number' | 'select'.
 *   - `knockout`: boolean toggle. `short_text` is never a knockout.
 *   - `options`: option strings, only relevant when `answerType === 'select'`.
 *   - `knockoutCondition`: the structured passing condition (see
 *     knockout-condition.ts). Serialised into `knockout_answer`. When a
 *     knockout is requested but the condition is missing/incomplete, yes_no
 *     defaults to "yes" and select to its first option; number with no valid
 *     value falls back to informational (no canonical default).
 */
import {
  encodeKnockoutAnswer,
  type KnockoutCondition,
  type ScreeningAnswerType,
} from './knockout-condition'

export type { ScreeningAnswerType }

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
  knockoutCondition?: KnockoutCondition | null
}

export function normalizeScreeningQuestionEntries(
  entries: ScreeningEntryInput[],
): NormalizedScreeningEntry[] {
  const out: NormalizedScreeningEntry[] = []

  for (const e of entries) {
    const label = e.label.trim()
    if (!label || label.length > 500) continue

    const answerType: ScreeningAnswerType = e.answerType ?? 'yes_no'
    const wantKnockout = Boolean(e.knockout)

    if (answerType === 'short_text') {
      out.push({ label, answer_type: 'short_text', is_knockout: false, knockout_answer: null, options: null })
      continue
    }

    if (answerType === 'number') {
      const ko = wantKnockout ? encodeKnockoutAnswer('number', e.knockoutCondition) : null
      out.push({
        label,
        answer_type: 'number',
        is_knockout: ko !== null,
        knockout_answer: ko,
        options: null,
      })
      continue
    }

    if (answerType === 'yes_no') {
      const ko = wantKnockout
        ? (encodeKnockoutAnswer('yes_no', e.knockoutCondition) ?? 'yes')
        : null
      out.push({
        label,
        answer_type: 'yes_no',
        is_knockout: ko !== null,
        knockout_answer: ko,
        options: null,
      })
      continue
    }

    // select
    const cleanedOptions = (e.options ?? [])
      .map((o) => o.trim())
      .filter((o) => o.length > 0 && o.length <= 200)
    if (cleanedOptions.length === 0) continue

    let ko: string | null = null
    if (wantKnockout) {
      const provided =
        e.knockoutCondition?.kind === 'select' ? e.knockoutCondition.passingOptions : []
      const passing = provided.filter((o) =>
        cleanedOptions.some((c) => c.toLowerCase() === o.trim().toLowerCase()),
      )
      const effective = passing.length > 0 ? passing : [cleanedOptions[0] as string]
      ko = encodeKnockoutAnswer('select', { kind: 'select', passingOptions: effective })
    }

    out.push({
      label,
      answer_type: 'select',
      is_knockout: ko !== null,
      knockout_answer: ko,
      options: cleanedOptions,
    })
  }

  return out
}

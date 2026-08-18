/**
 * Knockout passing-condition model for screening questions.
 *
 * A knockout question defines the condition under which an answer PASSES
 * (i.e. does NOT flag). The condition is serialised into the existing
 * `vacancy_screening_questions.knockout_answer` TEXT column so no schema
 * migration is needed — the encoding varies by `answer_type`:
 *
 *   - yes_no : the literal passing answer, "yes" or "no".
 *   - number : JSON `{ "op": "lte"|"gte"|"between", "value": n, "value2"?: n }`.
 *   - select : JSON array of the passing option strings, e.g. ["A","B"].
 *   - short_text : never a knockout (no canonical condition).
 *
 * Backwards-compatible: a plain (non-JSON) string is treated as a single
 * passing answer (the old "must = <answer>" rows still evaluate correctly).
 */

export type ScreeningAnswerType = 'yes_no' | 'short_text' | 'number' | 'select'
export type NumberOp = 'lte' | 'gte' | 'between'

export type KnockoutCondition =
  | { kind: 'yes_no'; passingAnswer: 'yes' | 'no' }
  | { kind: 'number'; op: NumberOp; value: number; value2?: number | null }
  | { kind: 'select'; passingOptions: string[] }

/**
 * Serialise a condition into the knockout_answer string. Returns null when the
 * condition is incomplete (e.g. a number knockout with no value, a select
 * knockout with no passing options) — the caller treats null as "informational".
 */
export function encodeKnockoutAnswer(
  answerType: ScreeningAnswerType,
  condition: KnockoutCondition | null | undefined,
): string | null {
  if (!condition) return null
  if (answerType === 'yes_no' && condition.kind === 'yes_no') {
    return condition.passingAnswer === 'no' ? 'no' : 'yes'
  }
  if (answerType === 'number' && condition.kind === 'number') {
    if (typeof condition.value !== 'number' || Number.isNaN(condition.value)) return null
    if (condition.op === 'between') {
      if (typeof condition.value2 !== 'number' || Number.isNaN(condition.value2)) return null
      const [lo, hi] = [condition.value, condition.value2].sort((a, b) => a - b)
      return JSON.stringify({ op: 'between', value: lo, value2: hi })
    }
    return JSON.stringify({ op: condition.op, value: condition.value })
  }
  if (answerType === 'select' && condition.kind === 'select') {
    const opts = condition.passingOptions.map((o) => o.trim()).filter(Boolean)
    if (opts.length === 0) return null
    return JSON.stringify(opts)
  }
  return null
}

interface ParsedNumberCondition {
  op: NumberOp
  value: number
  value2?: number
}

function parseNumberCondition(raw: string): ParsedNumberCondition | null {
  try {
    const obj = JSON.parse(raw)
    if (
      obj &&
      (obj.op === 'lte' || obj.op === 'gte' || obj.op === 'between') &&
      typeof obj.value === 'number'
    ) {
      if (obj.op === 'between' && typeof obj.value2 !== 'number') return null
      return obj as ParsedNumberCondition
    }
  } catch {
    /* not JSON — no valid number condition */
  }
  return null
}

function parseSelectPassing(raw: string): string[] {
  try {
    const obj = JSON.parse(raw)
    if (Array.isArray(obj)) return obj.map((o) => String(o))
  } catch {
    /* not JSON — treat as a single passing option (legacy rows) */
  }
  return [raw]
}

/**
 * Whether a candidate answer PASSES the knockout condition (true = no flag).
 * Missing/blank answers to a knockout question never pass. Returns true when
 * the condition can't be interpreted, to under-flag rather than over-flag.
 */
export function evaluateKnockoutPass(
  answerType: ScreeningAnswerType,
  knockoutAnswer: string | null | undefined,
  answer: string | null | undefined,
): boolean {
  if (!knockoutAnswer) return true
  const got = (answer ?? '').trim()
  if (!got) return false

  if (answerType === 'number') {
    const cond = parseNumberCondition(knockoutAnswer)
    if (!cond) return true
    const n = Number(got)
    if (Number.isNaN(n)) return false
    if (cond.op === 'lte') return n <= cond.value
    if (cond.op === 'gte') return n >= cond.value
    return n >= cond.value && n <= (cond.value2 as number)
  }

  if (answerType === 'select') {
    const passing = parseSelectPassing(knockoutAnswer).map((o) => o.trim().toLowerCase())
    return passing.includes(got.toLowerCase())
  }

  // yes_no (and any legacy single-answer): case-insensitive exact match.
  return got.toLowerCase() === knockoutAnswer.trim().toLowerCase()
}

/** Human-readable summary of a knockout condition for the recruiter UI. */
export function describeKnockoutAnswer(
  answerType: ScreeningAnswerType,
  knockoutAnswer: string | null | undefined,
): string | null {
  if (!knockoutAnswer) return null
  if (answerType === 'number') {
    const cond = parseNumberCondition(knockoutAnswer)
    if (!cond) return null
    if (cond.op === 'lte') return `passes when ≤ ${cond.value}`
    if (cond.op === 'gte') return `passes when ≥ ${cond.value}`
    return `passes when ${cond.value}–${cond.value2}`
  }
  if (answerType === 'select') {
    return `passes: ${parseSelectPassing(knockoutAnswer).join(', ')}`
  }
  return `passes when = ${knockoutAnswer}`
}

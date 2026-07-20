/**
 * Shared types + pure helpers for the vacancy scorecard wizard step (A-201).
 * Pure module so the step, its extracted parts, and other wizard steps all
 * import the same definitions.
 */

export interface ScorecardAttribute {
  label: string
  mustHave: boolean
}

export type ScreeningAnswerType = 'yes_no' | 'short_text' | 'number' | 'select'
export type NumberOp = 'lte' | 'gte' | 'between'

export interface ScorecardScreeningQuestion {
  label: string
  answerType: ScreeningAnswerType
  /** Knockout questions define a passing condition; a failing answer FLAGS
   * the application at screening (never auto-rejects). `short_text` can't be
   * a knockout — there's no canonical condition. */
  knockout: boolean
  /** Required when `answerType === 'select'`; ignored otherwise. */
  options?: string[] | undefined
  /** Passing condition (only meaningful when `knockout`). One field set is
   * used per `answerType`. */
  passYesNo: 'yes' | 'no'
  numberOp: NumberOp
  numberValue: number | null
  numberValue2: number | null
  /** Passing option subset for `select` knockouts. */
  passOptions: string[]
}

export const supportsKnockout = (t: ScreeningAnswerType) => t !== 'short_text'

/** A fresh screening question, informational by default. */
export function blankQuestion(
  label: string,
  answerType: ScreeningAnswerType,
  options?: string[],
): ScorecardScreeningQuestion {
  return {
    label,
    answerType,
    knockout: false,
    options,
    passYesNo: 'yes',
    numberOp: 'lte',
    numberValue: null,
    numberValue2: null,
    passOptions: answerType === 'select' && options && options.length > 0 ? [options[0]!] : [],
  }
}

export interface ScorecardState {
  attributes: ScorecardAttribute[]
  screeningQuestions: ScorecardScreeningQuestion[]
}

/** Role context the "Suggest from JD" assist sends at click time. */
export interface ScorecardJdContext {
  title: string
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  sector_name: string | null
  description: string | null
  responsibilities: string | null
  requirements: string | null
}

export const TYPE_LABELS: Record<ScreeningAnswerType, string> = {
  yes_no: 'Yes / No',
  short_text: 'Short text',
  number: 'Number',
  select: 'Select',
}

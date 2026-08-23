// Types for AI Fit Analysis (Wave 3.1). The output is deliberately
// evidence-based with NO overall numeric score (spec Guardrail 1): a factual
// "meets N of M must-haves" count + per-criterion match + cited evidence.

export type FitConfidence = 'low' | 'medium' | 'high'
export type FitAssessment = 'agree' | 'override'
/** Async lifecycle of an analysis row. `pending` = queued/running in the
 * background; `completed` = outputs filled; `failed` = model/parse error. */
export type FitStatus = 'pending' | 'completed' | 'failed'

/** One scorecard criterion (from the vacancy's `vacancy_questions`). The
 * per-criterion `match_degree` is evidence-backed — it is NOT a verdict on the
 * person, and there is no aggregate score across criteria. */
export interface FitCriterion {
  /** Matches a `vacancy_questions.label` — never invented by the model. */
  name: string
  must_have: boolean
  /** 0–100 fit against THIS criterion, justified by `evidence`. */
  match_degree: number
  /** Quote(s) from the sanitized CV / screening answers. */
  evidence: string
  /** Plain-language reasoning. */
  explanation: string
}

/** The structured analysis rendered in the card. */
export interface RenderedFitAnalysis {
  meets_count: number
  must_have_total: number
  confidence: FitConfidence
  criteria: FitCriterion[]
  strengths: { text: string; evidence: string }[]
  to_verify: { text: string }[]
  suggested_questions: string[]
}

/** A stored analysis row (`ai_fit_analyses`). Output fields are nullable while
 * an analysis is `pending` (they're filled once it completes). */
export interface AiFitAnalysis {
  id: string
  application_id: string
  /** Async lifecycle — pending rows have null outputs; see {@link FitStatus}. */
  status: FitStatus
  /** Set when status = 'failed' (e.g. 'timeout' | 'failed' | 'unparseable'). */
  error_reason: string | null
  meets_count: number | null
  must_have_total: number | null
  confidence: FitConfidence | null
  rendered_analysis: RenderedFitAnalysis | null
  redacted_categories: string[]
  model_name: string | null
  model_version: string | null
  prompt_version: string | null
  // Mandatory human oversight (Agree/Override)
  assessment: FitAssessment | null
  assessment_reason: string | null
  assessed_by: string | null
  assessed_at: string | null
  created_by: string | null
  created_at: string
}

/** Org-level opt-in + geofencing state (`organizations`). */
export interface OrgAiFitSettings {
  ai_fit_enabled: boolean
  ai_fit_eu_acknowledged: boolean
  billing_country: string | null
}

/** A manual bias-review log entry (`ai_fit_bias_reviews`). */
export interface BiasReview {
  id: string
  reviewed_on: string
  reviewer: string
  summary: string
  action_taken: string | null
  created_by: string | null
  created_at: string
}

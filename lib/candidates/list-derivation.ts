import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { isTerminalStage } from '@/lib/pipeline/stage-style'
import type { FieldType } from '@/lib/actions/custom-fields'

/**
 * Pure data-derivation helpers for the Candidates list page
 * (`app/(dashboard)/candidates/page.tsx`).
 *
 * Extracted from the page (A-002) so the fit-score / stage / custom-field
 * shaping can be unit-tested without a Supabase round-trip. The page keeps
 * the queries; these functions take the raw rows and produce the maps the
 * table renders from.
 */

export interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  current_company: string | null
  current_position: string | null
  years_of_experience: number | null
  source: string | null
  general_status_id: string | null
  location: string | null
  salary_expectation: string | null
  notice_period: string | null
  languages: string[] | null
  created_at: string
  updated_at: string
}

export interface VacancyOption {
  id: string
  title: string
}

export interface StageJoinRow {
  name: string
  type: 'standard' | 'review' | 'interview' | 'offer'
  is_terminal: boolean
}

export interface ApplicationRow {
  id: string
  candidate_id: string
  vacancy_id: string
  applied_at: string
  pipeline_stage_id: string | null
  vacancies: { id: string; title: string }[] | { id: string; title: string } | null
  pipeline_stages: StageJoinRow | StageJoinRow[] | null
}

export interface EvaluationRow {
  application_id: string
  score: number | null
}

export interface CustomFieldValueRow {
  field_id: string
  entity_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_option: string | null
}

/** Normalise the possibly-array PostgREST join into a single stage row. */
export function stageOf(app: ApplicationRow): StageJoinRow | null {
  const j = app.pipeline_stages
  return Array.isArray(j) ? (j[0] ?? null) : j
}

/** Resolve the vacancy title from the possibly-array PostgREST join. */
export function getVacancyTitle(app: ApplicationRow): string | null {
  if (!app.vacancies) return null
  if (Array.isArray(app.vacancies)) return app.vacancies[0]?.title || null
  return (app.vacancies as { title: string }).title || null
}

/** Group applications by candidate, preserving input order per candidate. */
export function groupApplicationsByCandidate(
  applications: ApplicationRow[],
): Map<string, ApplicationRow[]> {
  const byCandidate = new Map<string, ApplicationRow[]>()
  for (const app of applications) {
    const existing = byCandidate.get(app.candidate_id) || []
    existing.push(app)
    byCandidate.set(app.candidate_id, existing)
  }
  return byCandidate
}

/**
 * Fit score per application = the average of the *submitted* reviewer cards'
 * numeric scores, rounded. Rows with a non-numeric score are ignored.
 */
export function aggregateFitScores(evalRows: EvaluationRow[]): Map<string, number> {
  const agg = new Map<string, { total: number; count: number }>()
  for (const row of evalRows) {
    if (typeof row.score === 'number') {
      const cur = agg.get(row.application_id) ?? { total: 0, count: 0 }
      cur.total += row.score
      cur.count += 1
      agg.set(row.application_id, cur)
    }
  }
  const byApplication = new Map<string, number>()
  for (const [appId, { total, count }] of agg) {
    byApplication.set(appId, Math.round(total / count))
  }
  return byApplication
}

export interface DerivedStage {
  code: string
  name: string
}

/**
 * Per-candidate Stage + Fit-score columns: derive from each candidate's
 * *active* (non-terminal) application, falling back to their first
 * application. Stage is bucket-mapped so the badge uses the same palette as
 * the Pipeline; fit is the score on that same application.
 */
export function deriveStageAndFit(
  applicationsByCandidate: Map<string, ApplicationRow[]>,
  fitScoreByApplication: Map<string, number>,
): {
  stageByCandidate: Map<string, DerivedStage>
  fitScoreByCandidate: Map<string, number>
} {
  const stageByCandidate = new Map<string, DerivedStage>()
  const fitScoreByCandidate = new Map<string, number>()

  for (const [candId, apps] of applicationsByCandidate) {
    const active =
      apps.find((a) => {
        const s = stageOf(a)
        return s ? !isTerminalStage(mapPipelineStageToBucket(s)) : false
      }) ?? apps[0]
    if (!active) continue

    const stageRow = stageOf(active)
    if (stageRow) {
      stageByCandidate.set(candId, {
        code: mapPipelineStageToBucket(stageRow),
        name: stageRow.name,
      })
    }
    const fit = fitScoreByApplication.get(active.id)
    if (typeof fit === 'number') fitScoreByCandidate.set(candId, fit)
  }

  return { stageByCandidate, fitScoreByCandidate }
}

/**
 * Format a single custom-field value row for display, keyed off the field's
 * type. Returns null for empty / unset values (so the caller can skip them).
 */
export function formatCustomFieldValue(
  type: FieldType | undefined,
  row: Pick<CustomFieldValueRow, 'value_text' | 'value_number' | 'value_boolean' | 'value_option'>,
): string | null {
  let display: string | null
  if (type === 'number') display = row.value_number != null ? String(row.value_number) : null
  else if (type === 'checkbox') display = row.value_boolean == null ? null : row.value_boolean ? 'Yes' : 'No'
  else if (type === 'dropdown') display = row.value_option
  else display = row.value_text // text / long_text / date
  if (display != null && display !== '') return display
  return null
}

/**
 * Build the `${entityId}:${fieldId}` → display map for the visible candidates.
 */
export function buildCustomFieldValueMap(
  rows: CustomFieldValueRow[],
  typeByFieldId: Map<string, FieldType>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const v of rows) {
    const display = formatCustomFieldValue(typeByFieldId.get(v.field_id), v)
    if (display != null) map.set(`${v.entity_id}:${v.field_id}`, display)
  }
  return map
}

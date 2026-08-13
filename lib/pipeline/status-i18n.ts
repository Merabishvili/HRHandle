/**
 * i18n keys per canonical application-status code — the pipeline board columns
 * + terminal rail show these (Applied / Screening / … / Rejected / Withdrawn).
 * The status names in the DB are English seed data; callers translate via t().
 * Reuses the reports.stage.* keys for the shared funnel stages.
 */
export const APP_STATUS_I18N_KEY: Record<string, string> = {
  applied: 'reports.stage.applied',
  screening: 'reports.stage.screening',
  interview: 'reports.stage.interview',
  offer: 'reports.stage.offer',
  hired: 'reports.stage.hired',
  rejected: 'pipeline.status.rejected',
  withdrawn: 'pipeline.status.withdrawn',
}

/** Translated status label for a code, falling back to the raw DB name. */
export function statusLabel(
  t: (key: string) => string,
  code: string,
  fallback: string,
): string {
  const key = APP_STATUS_I18N_KEY[code]
  return key ? t(key) : fallback
}

/**
 * The 7 default per-vacancy pipeline stages are seeded with these exact English
 * names (Migration 046 / `defaultStageNameForCode`). Reverse-map a stage name
 * back to its canonical code so a *default* stage renders localized while a
 * custom stage ("Technical Interview") keeps its as-typed name.
 */
const DEFAULT_STAGE_NAME_TO_CODE: Record<string, string> = {
  applied: 'applied',
  screening: 'screening',
  interview: 'interview',
  offer: 'offer',
  hired: 'hired',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
}

/** Localize a pipeline-stage name when it's one of the seeded defaults; custom
 * names pass through unchanged. */
export function pipelineStageLabel(t: (key: string) => string, name: string): string {
  const code = DEFAULT_STAGE_NAME_TO_CODE[name.trim().toLowerCase()]
  return code ? statusLabel(t, code, name) : name
}

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

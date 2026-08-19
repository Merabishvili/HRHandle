/**
 * Localize a candidate/application `source` value for display. The source is
 * stored as free English text (e.g. public-apply writes "Public Form"); this
 * maps the app-generated values to i18n keys and passes anything else (a
 * recruiter's free-text source) through unchanged. Mirrors sectorLabel /
 * statusLabel.
 */
export function sourceLabel(
  t: (key: string) => string,
  raw: string | null | undefined,
): string {
  if (!raw) return ''
  const s = raw.trim()
  if (!s) return ''
  if (/^public form$/i.test(s) || /^public apply/i.test(s)) return t('source.publicForm')
  if (/^linkedin/i.test(s)) return t('source.linkedin')
  if (/^csv/i.test(s)) return t('source.csv')
  if (/^manual/i.test(s)) return t('source.manual')
  if (/^(company )?website/i.test(s)) return t('source.website')
  if (/^job board/i.test(s)) return t('source.jobBoard')
  return s
}

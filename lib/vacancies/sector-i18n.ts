/**
 * i18n labels for the global `sectors` lookup. The sector rows are fixed English
 * seed data (Financial / IT / Sales / …) shared across tenants, so their names
 * are stable — we key the translation off the English `name` rather than
 * threading the `code` column through every display site. Any custom/unknown
 * sector name falls back to the raw name.
 *
 * Mirrors the `statusLabel` pattern in lib/pipeline/status-i18n.ts.
 */
export const SECTOR_I18N_KEY: Record<string, string> = {
  Financial: 'sector.financial',
  IT: 'sector.it',
  Sales: 'sector.sales',
  Marketing: 'sector.marketing',
  HR: 'sector.hr',
  Operations: 'sector.operations',
  Legal: 'sector.legal',
  'Customer Support': 'sector.customerSupport',
}

/** Translated sector label for a DB sector name, falling back to the raw name.
 * Returns '' for a null/empty name so callers can apply their own placeholder. */
export function sectorLabel(
  t: (key: string) => string,
  name: string | null | undefined,
): string {
  if (!name) return ''
  const key = SECTOR_I18N_KEY[name]
  return key ? t(key) : name
}

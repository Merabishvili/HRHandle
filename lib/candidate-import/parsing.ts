// Server-side CSV parsing helpers for the candidate bulk-import flow.
//
// There is NO column-mapping step: an uploaded file must use the template's
// exact header row (case-insensitive, whitespace-trimmed). Anything else is
// rejected at upload. See `validateHeaders`.

export const IMPORT_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'current_company',
  'current_position',
  'years_of_experience',
  'linkedin_url',
  'location',
  'source',
  'languages',
  'salary_expectation',
  'notice_period',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Canonical template header row, in order. The uploaded file must match it. */
export const TEMPLATE_HEADERS: readonly ImportField[] = IMPORT_FIELDS

/**
 * Columns whose presence is mandatory (missing → file rejected). Email is a
 * template column but is NOT required — email-less sourced candidates import
 * fine; only its *format* is validated when present (see validation.ts).
 */
export const REQUIRED_HEADERS: readonly ImportField[] = ['first_name', 'last_name']

export const MAX_ROWS = 5000
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Strip a leading UTF-8 BOM if present. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Heuristic non-UTF-8 detection. `File.text()` decodes as UTF-8 and emits the
 * replacement char U+FFFD for invalid byte sequences, so its presence is a
 * reliable "this wasn't UTF-8" signal for our purposes.
 */
export function looksNonUtf8(text: string): boolean {
  return text.includes('�')
}

/**
 * Pick the delimiter from the header line: comma by default, semicolon as a
 * fallback (common in Excel exports from a Georgian/EU locale). Whichever
 * appears more often on the first line wins.
 */
export function detectDelimiter(firstLine: string): ',' | ';' {
  let commas = 0
  let semis = 0
  let inQuotes = false
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch === ',') commas++
    else if (!inQuotes && ch === ';') semis++
  }
  return semis > commas ? ';' : ','
}

/** Normalize a header cell for template matching: lowercase + trim. */
export function normalizeHeader(raw: string): string {
  return String(raw ?? '').toLowerCase().trim()
}

export interface HeaderCheck {
  ok: boolean
  /** Original text of the first header that doesn't belong to the template. */
  unknownHeader?: string
  /** Field name of the first required column that's missing. */
  missingRequiredHeader?: ImportField
  /** Template fields that ARE present, in file-column order. */
  presentFields: ImportField[]
}

const TEMPLATE_SET = new Set<string>(TEMPLATE_HEADERS)

/**
 * Hard gate on the header row (there is no mapping step). Unknown column →
 * reject; missing required column → reject; missing optional column → accept
 * (that field is empty for every row).
 */
export function validateHeaders(rawHeaders: string[]): HeaderCheck {
  const present: ImportField[] = []
  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw)
    if (!TEMPLATE_SET.has(norm)) {
      return { ok: false, unknownHeader: String(raw ?? '').trim(), presentFields: [] }
    }
    present.push(norm as ImportField)
  }
  const presentSet = new Set(present)
  const missing = REQUIRED_HEADERS.find((h) => !presentSet.has(h))
  if (missing) {
    return { ok: false, missingRequiredHeader: missing, presentFields: present }
  }
  return { ok: true, presentFields: present }
}

/**
 * Build a mapper from a raw CSV data row to a field→value record, using the
 * header row for column positions. Cells are trimmed; empty → null. Columns
 * absent from the file map to null for every row.
 */
export function buildValueMapper(
  rawHeaders: string[],
): (row: string[]) => Record<ImportField, string | null> {
  const indexByField = new Map<ImportField, number>()
  rawHeaders.forEach((raw, idx) => {
    const norm = normalizeHeader(raw)
    if (TEMPLATE_SET.has(norm) && !indexByField.has(norm as ImportField)) {
      indexByField.set(norm as ImportField, idx)
    }
  })
  return (row: string[]) => {
    const out = {} as Record<ImportField, string | null>
    for (const field of IMPORT_FIELDS) {
      const idx = indexByField.get(field)
      const cell = idx === undefined ? undefined : row[idx]
      const trimmed = cell === undefined || cell === null ? '' : String(cell).trim()
      out[field] = trimmed.length === 0 ? null : trimmed
    }
    return out
  }
}

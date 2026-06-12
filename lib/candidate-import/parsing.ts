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

export const REQUIRED_FIELDS: ReadonlyArray<ImportField> = [
  'first_name',
  'last_name',
  'email',
]

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  phone: 'Phone',
  current_company: 'Current company',
  current_position: 'Current position',
  years_of_experience: 'Years of experience',
  linkedin_url: 'LinkedIn URL',
  location: 'Location',
  source: 'Source',
  languages: 'Languages',
  salary_expectation: 'Salary expectation',
  notice_period: 'Notice period',
}

export const MAX_ROWS = 1000
export const MAX_FILE_BYTES = 5 * 1024 * 1024

const HEADER_ALIASES: Record<ImportField, string[]> = {
  first_name: ['first name', 'firstname', 'first', 'given name', 'givenname'],
  last_name: ['last name', 'lastname', 'last', 'surname', 'family name', 'familyname'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'phone number', 'mobile', 'tel', 'telephone', 'cell'],
  current_company: ['current company', 'company', 'employer', 'organization', 'organisation'],
  current_position: ['current position', 'position', 'role', 'title', 'job title', 'jobtitle'],
  years_of_experience: ['years of experience', 'experience', 'yoe', 'years experience', 'years'],
  linkedin_url: ['linkedin url', 'linkedin', 'linkedin profile', 'linkedin profile url'],
  location: ['location', 'city', 'country', 'address'],
  source: ['source', 'channel', 'referred by'],
  languages: ['languages', 'language', 'spoken languages'],
  salary_expectation: ['salary expectation', 'salary', 'expected salary', 'compensation'],
  notice_period: ['notice period', 'notice', 'availability'],
}

export function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Infer field mapping from CSV headers.
 * Returns an array the same length as `headers`; entry is the inferred field or null.
 */
export function inferMapping(headers: string[]): (ImportField | null)[] {
  const taken = new Set<ImportField>()
  return headers.map((raw) => {
    const norm = normalizeHeader(raw)
    if (!norm) return null
    for (const field of IMPORT_FIELDS) {
      if (taken.has(field)) continue
      if (HEADER_ALIASES[field].includes(norm)) {
        taken.add(field)
        return field
      }
    }
    return null
  })
}

export function missingRequiredFields(
  mapping: ReadonlyArray<ImportField | null>
): ImportField[] {
  const mapped = new Set(mapping.filter((m): m is ImportField => m !== null))
  return REQUIRED_FIELDS.filter((f) => !mapped.has(f))
}

/** Pick the cell value for a target field from a CSV row using the column mapping. */
export function pickCell(
  row: string[],
  mapping: ReadonlyArray<ImportField | null>,
  target: ImportField
): string | null {
  const idx = mapping.indexOf(target)
  if (idx === -1) return null
  const v = row[idx]
  if (v === undefined || v === null) return null
  const trimmed = String(v).trim()
  return trimmed.length === 0 ? null : trimmed
}

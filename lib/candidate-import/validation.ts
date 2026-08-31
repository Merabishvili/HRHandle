import { IMPORT_FIELDS, type ImportField } from './parsing'

// Per-row validation for the candidate bulk-import review table.
//
// Rules (prompt §2.3), with email made OPTIONAL per product decision:
//   - first_name / last_name : required (non-empty after trim)
//   - email                  : optional; if present, valid shape.
//                              Duplicate (already in DB, or repeated in the
//                              file) is a row error — only checked when an
//                              email is present.
//   - phone                  : optional; ≥9 digits after stripping non-digits
//   - years_of_experience    : optional; integer 0–60
//   - linkedin_url           : optional; valid URL or `in/handle` shape
//   - salary_expectation     : optional; number + optional currency
//   - everything else        : free text, no validation
//
// Validators are pure and shared verbatim by the parse route (server) and the
// review table (client), so a cell edit re-validates locally with no round-trip.

export type ImportErrorCode =
  | 'firstNameRequired'
  | 'lastNameRequired'
  | 'emailInvalid'
  | 'dupExisting'
  | 'dupInFile'
  | 'phoneInvalid'
  | 'yoeInvalid'
  | 'linkedinInvalid'
  | 'salaryInvalid'

export interface ImportError {
  /** Field whose cell should be highlighted. Duplicate errors attach to `email`. */
  field: ImportField
  code: ImportErrorCode
}

export type ImportValues = Record<ImportField, string | null>

export interface DraftRow {
  /** Original 1-based CSV data-row number (header excluded). Never renumbers. */
  csvRow: number
  values: ImportValues
}

export interface ValidatedRow extends DraftRow {
  errors: ImportError[]
  status: 'ready' | 'error'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 9
}

export function isValidYearsOfExperience(value: string): boolean {
  const v = value.trim()
  if (!/^\d{1,3}$/.test(v)) return false
  const n = Number(v)
  return n >= 0 && n <= 60
}

export function isValidLinkedin(value: string): boolean {
  const v = value.trim()
  if (/^in\/[^\s/]+$/i.test(v)) return true // `in/handle` short shape
  if (/(^|\.)linkedin\.com\//i.test(v)) return true // any linkedin.com/... URL
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidSalary(value: string): boolean {
  const v = value.trim().replace(/\s+/g, '')
  // Optional currency (letters or symbol) on either side of a number.
  return /^[A-Za-z$€₾£]{0,4}[\d][\d.,]*[A-Za-z$€₾£]{0,4}$/.test(v)
}

/** Field-level validation for a single row (everything except duplicates). */
export function validateFields(values: ImportValues): ImportError[] {
  const errors: ImportError[] = []

  if (!(values.first_name ?? '').trim()) {
    errors.push({ field: 'first_name', code: 'firstNameRequired' })
  }
  if (!(values.last_name ?? '').trim()) {
    errors.push({ field: 'last_name', code: 'lastNameRequired' })
  }

  const email = (values.email ?? '').trim()
  if (email && !isValidEmail(email)) {
    errors.push({ field: 'email', code: 'emailInvalid' })
  }

  const phone = (values.phone ?? '').trim()
  if (phone && !isValidPhone(phone)) {
    errors.push({ field: 'phone', code: 'phoneInvalid' })
  }

  const yoe = (values.years_of_experience ?? '').trim()
  if (yoe && !isValidYearsOfExperience(yoe)) {
    errors.push({ field: 'years_of_experience', code: 'yoeInvalid' })
  }

  const linkedin = (values.linkedin_url ?? '').trim()
  if (linkedin && !isValidLinkedin(linkedin)) {
    errors.push({ field: 'linkedin_url', code: 'linkedinInvalid' })
  }

  const salary = (values.salary_expectation ?? '').trim()
  if (salary && !isValidSalary(salary)) {
    errors.push({ field: 'salary_expectation', code: 'salaryInvalid' })
  }

  return errors
}

/**
 * Validate the whole dataset: field rules + duplicate detection.
 *
 * `existingEmails` is the set of lowercased emails already on active candidates
 * in the org (batched once at parse; re-checked at commit). Duplicate checks
 * only apply to rows that carry a syntactically-valid email.
 */
export function validateDataset(
  rows: DraftRow[],
  existingEmails: ReadonlySet<string>,
): ValidatedRow[] {
  // Count in-file email occurrences (valid emails only) to flag repeats.
  const inFileCount = new Map<string, number>()
  for (const r of rows) {
    const email = (r.values.email ?? '').trim().toLowerCase()
    if (email && isValidEmail(email)) {
      inFileCount.set(email, (inFileCount.get(email) ?? 0) + 1)
    }
  }

  return rows.map((r) => {
    const errors = validateFields(r.values)
    const email = (r.values.email ?? '').trim().toLowerCase()
    if (email && isValidEmail(email)) {
      if (existingEmails.has(email)) {
        errors.push({ field: 'email', code: 'dupExisting' })
      } else if ((inFileCount.get(email) ?? 0) > 1) {
        errors.push({ field: 'email', code: 'dupInFile' })
      }
    }
    return { ...r, errors, status: errors.length > 0 ? 'error' : 'ready' }
  })
}

export function summarize(rows: ValidatedRow[]): { total: number; ready: number; error: number } {
  let ready = 0
  let error = 0
  for (const r of rows) {
    if (r.status === 'ready') ready++
    else error++
  }
  return { total: rows.length, ready, error }
}

/** Coerce a validated row's raw string values into a candidates INSERT payload. */
export function toCandidateInsert(
  values: ImportValues,
  base: { organization_id: string; created_by: string; import_id: string },
): Record<string, unknown> {
  const email = (values.email ?? '').trim().toLowerCase() || null

  const yoeRaw = (values.years_of_experience ?? '').trim()
  const yoe = yoeRaw && /^\d{1,3}$/.test(yoeRaw) ? Number(yoeRaw) : null

  const langRaw = (values.languages ?? '').trim()
  const languages = langRaw
    ? langRaw.split(/[;,]/).map((s) => s.trim()).filter((s) => s.length > 0)
    : []

  const text = (v: string | null | undefined) => {
    const s = (v ?? '').trim()
    return s.length > 0 ? s : null
  }

  return {
    organization_id: base.organization_id,
    created_by: base.created_by,
    import_id: base.import_id,
    first_name: (values.first_name ?? '').trim(),
    last_name: (values.last_name ?? '').trim(),
    email,
    phone: text(values.phone),
    current_company: text(values.current_company),
    current_position: text(values.current_position),
    years_of_experience: yoe,
    linkedin_profile_url: text(values.linkedin_url),
    location: text(values.location),
    source: text(values.source),
    languages,
    salary_expectation: text(values.salary_expectation),
    notice_period: text(values.notice_period),
  }
}

export { IMPORT_FIELDS }

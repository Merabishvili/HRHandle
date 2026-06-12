import { z } from 'zod'
import { IMPORT_FIELDS, type ImportField } from './parsing'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))

export const ImportRowSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255)
    .transform((v) => v.toLowerCase()),
  phone: optionalText(30),
  current_company: optionalText(200),
  current_position: optionalText(200),
  years_of_experience: z
    .number()
    .min(0)
    .max(80)
    .nullable(),
  linkedin_url: z
    .string()
    .url('Invalid LinkedIn URL')
    .max(500)
    .nullable(),
  location: optionalText(200),
  source: optionalText(100),
  languages: z.array(z.string()).default([]),
  salary_expectation: optionalText(200),
  notice_period: optionalText(100),
})

export type ImportRow = z.infer<typeof ImportRowSchema>

export interface RawRow {
  // Raw cell map by target field, before coercion
  values: Partial<Record<ImportField, string | null>>
}

/**
 * Coerce raw string cells into typed values for the schema:
 * - years_of_experience: parsed as float, null if blank/NaN
 * - languages: split on ; or , into trimmed non-empty entries
 * - linkedin_url: null if blank
 */
export function coerceRow(raw: RawRow): Record<ImportField, unknown> {
  const v = raw.values
  const yoeRaw = v.years_of_experience
  let yoe: number | null = null
  if (yoeRaw !== undefined && yoeRaw !== null && yoeRaw !== '') {
    const n = Number.parseFloat(String(yoeRaw).replace(',', '.'))
    yoe = Number.isFinite(n) ? n : NaN as unknown as number
  }

  const langRaw = v.languages
  const languages =
    langRaw && langRaw.length > 0
      ? langRaw
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : []

  return {
    first_name: v.first_name ?? '',
    last_name: v.last_name ?? '',
    email: v.email ?? '',
    phone: v.phone ?? null,
    current_company: v.current_company ?? null,
    current_position: v.current_position ?? null,
    years_of_experience: yoe,
    linkedin_url: v.linkedin_url ?? null,
    location: v.location ?? null,
    source: v.source ?? null,
    languages,
    salary_expectation: v.salary_expectation ?? null,
    notice_period: v.notice_period ?? null,
  }
}

export interface RowValidationOk {
  ok: true
  row: ImportRow
}

export interface RowValidationError {
  ok: false
  error: string
}

export function validateRow(raw: RawRow): RowValidationOk | RowValidationError {
  const coerced = coerceRow(raw)
  const parsed = ImportRowSchema.safeParse(coerced)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    const path = first.path.join('.')
    return { ok: false, error: path ? `${path}: ${first.message}` : first.message }
  }
  return { ok: true, row: parsed.data }
}

/** Escape a single CSV cell value: wrap in quotes if it contains a comma, quote, or newline. */
export function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export interface ErrorReportRow {
  rowNumber: number
  original: string[]
  error: string
}

/** Build a CSV string of failed rows: original headers + appended 'row' and 'error' columns. */
export function buildErrorReportCsv(
  headers: string[],
  failures: ErrorReportRow[]
): string {
  const outHeaders = ['row', ...headers, 'error']
  const lines: string[] = [outHeaders.map(escapeCsvCell).join(',')]
  for (const f of failures) {
    const cells = [String(f.rowNumber), ...f.original, f.error]
    lines.push(cells.map(escapeCsvCell).join(','))
  }
  return lines.join('\n')
}

export { IMPORT_FIELDS }

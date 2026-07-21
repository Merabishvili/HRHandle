/**
 * Escape a value for a single CSV cell.
 *
 * Does two things:
 *  1. **Formula-injection guard (OWASP CSV injection).** A cell whose value
 *     starts with `=`, `+`, `-`, `@`, a tab, or a carriage return is treated
 *     as a formula by Excel / Google Sheets / LibreOffice. Since some exported
 *     values are user-controlled (candidate names / notes come from the public
 *     apply form), we prefix such values with a single quote so the spreadsheet
 *     renders them as text, never executes them.
 *  2. **Delimiter quoting.** Values containing a comma, double-quote, or newline
 *     are wrapped in double quotes with internal quotes doubled (RFC 4180).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

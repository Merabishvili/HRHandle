import 'server-only'
import ExcelJS from 'exceljs'

/** Flatten one ExcelJS cell value to a plain string (handles rich text, hyperlinks, formulas, dates). */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((p) => p.text ?? '').join('')
    }
    if ('result' in v) return cellToString(v.result)
    if ('text' in v) return String(v.text ?? '')
    if ('hyperlink' in v) return String(v.hyperlink ?? '')
    if ('error' in v) return ''
  }
  return String(value)
}

/**
 * Read an uploaded .xlsx buffer into a header + data-row table (string[][]),
 * matching the shape the CSV path produces so the rest of the pipeline
 * (header gate, value mapper, validation) is identical. First worksheet only;
 * fully-empty rows are skipped.
 */
export async function parseXlsxToTable(buffer: ArrayBuffer | Uint8Array | Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook()
  // ExcelJS types `load` as `Buffer`, but it accepts ArrayBuffer/Uint8Array at
  // runtime (that's what `File.arrayBuffer()` gives us). `as never` sidesteps
  // the TS Buffer<ArrayBufferLike> vs <ArrayBuffer> generic split.
  await wb.xlsx.load(buffer as never)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const table: string[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    // `row.values` is 1-indexed (index 0 is always empty); sparse cells are
    // undefined at their column position, preserving alignment.
    const vals = row.values as unknown[]
    const cells: string[] = []
    for (let c = 1; c < vals.length; c++) cells.push(cellToString(vals[c]))
    // Drop trailing empty cells so a stray formatted-but-blank column doesn't
    // look like an extra (unknown) header.
    while (cells.length > 0 && cells[cells.length - 1]!.trim() === '') cells.pop()
    if (cells.length > 0) table.push(cells)
  })
  return table
}

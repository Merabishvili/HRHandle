import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildValueMapper,
  detectDelimiter,
  looksNonUtf8,
  stripBom,
  validateHeaders,
  MAX_FILE_BYTES,
  MAX_ROWS,
} from '@/lib/candidate-import/parsing'
import {
  validateDataset,
  summarize,
  type DraftRow,
} from '@/lib/candidate-import/validation'

export const maxDuration = 60

/** Cap the existing-email set shipped to the client for local dup re-checking. */
const EXISTING_EMAIL_CAP = 20000

function bad(error: string, extra: Record<string, unknown> = {}, status = 400) {
  return NextResponse.json({ error, ...extra }, { status })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('unauthorized', {}, 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return bad('unauthorized', {}, 401)
  if (profile.role !== 'owner' && profile.role !== 'admin') return bad('forbidden', {}, 403)
  const orgId = profile.organization_id as string

  // --- read the file ---
  let file: File | null = null
  try {
    const form = await request.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return bad('parseError')
  }
  if (!file) return bad('noFile')
  if (file.size > MAX_FILE_BYTES) {
    return bad('tooLarge', { maxMb: Math.round(MAX_FILE_BYTES / (1024 * 1024)) })
  }

  const rawText = stripBom(await file.text())
  if (looksNonUtf8(rawText)) return bad('notUtf8')
  if (!rawText.trim()) return bad('empty')

  // --- parse ---
  const firstLine = rawText.slice(0, rawText.indexOf('\n') === -1 ? undefined : rawText.indexOf('\n'))
  const delimiter = detectDelimiter(firstLine)
  const parsed = Papa.parse<string[]>(rawText, { delimiter, skipEmptyLines: true })
  if (parsed.errors.length > 0) {
    return bad('parseError', { message: parsed.errors[0]?.message ?? 'unknown' })
  }
  const table = parsed.data as string[][]
  if (table.length === 0) return bad('empty')

  const headers = (table[0] ?? []).map((h) => String(h ?? ''))
  const dataRows = table.slice(1)
  if (dataRows.length === 0) return bad('noRows')
  if (dataRows.length > MAX_ROWS) return bad('tooManyRows', { count: dataRows.length, max: MAX_ROWS })

  // --- header hard gate (no mapping step) ---
  const headerCheck = validateHeaders(headers)
  if (!headerCheck.ok) {
    if (headerCheck.unknownHeader !== undefined) {
      return bad('unknownHeader', { header: headerCheck.unknownHeader })
    }
    return bad('missingRequiredHeader', { header: headerCheck.missingRequiredHeader })
  }

  // --- build draft rows ---
  const toValues = buildValueMapper(headers)
  const draftRows: DraftRow[] = dataRows.map((row, idx) => ({
    csvRow: idx + 1,
    values: toValues(row),
  }))

  // --- existing emails (one batched query) ---
  const { data: existingRows } = await supabase
    .from('candidates')
    .select('email')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .limit(EXISTING_EMAIL_CAP)
  const existingEmails = new Set(
    (existingRows ?? [])
      .map((r) => (r.email ?? '').toLowerCase())
      .filter((e) => e.length > 0),
  )

  const validated = validateDataset(draftRows, existingEmails)

  // --- persist the draft (admin client; RLS is enforced via explicit owner cols) ---
  const admin = createAdminClient()
  const { data: draft, error: draftError } = await admin
    .from('candidate_import_drafts')
    .insert({
      organization_id: orgId,
      created_by: user.id,
      filename: file.name,
      headers,
      rows: draftRows,
      size_bytes: file.size,
      column_count: headers.length,
      initial_row_count: draftRows.length,
    })
    .select('id')
    .single()

  if (draftError || !draft) {
    return bad('draftFailed', { message: draftError?.message }, 500)
  }

  return NextResponse.json({
    importId: draft.id,
    filename: file.name,
    columns: headers.length,
    size: file.size,
    rows: validated,
    counts: summarize(validated),
    existingEmails: Array.from(existingEmails),
  })
}

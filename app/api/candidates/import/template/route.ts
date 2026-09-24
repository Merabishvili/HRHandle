import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { IMPORT_FIELDS } from '@/lib/candidate-import/parsing'

export const runtime = 'nodejs'

// One illustrative row so users see the expected shape of each column.
const EXAMPLE: Record<(typeof IMPORT_FIELDS)[number], string> = {
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane.doe@example.com',
  phone: '+1 555 123 4567',
  current_company: 'Acme Corp',
  current_position: 'Senior Engineer',
  years_of_experience: '8',
  linkedin_url: 'https://www.linkedin.com/in/janedoe/',
  location: 'Berlin',
  source: 'Referral',
  languages: 'English;German',
  salary_expectation: '80000 EUR',
  notice_period: '1 month',
}

const WIDTHS: Partial<Record<(typeof IMPORT_FIELDS)[number], number>> = {
  email: 28,
  phone: 18,
  current_company: 18,
  current_position: 20,
  linkedin_url: 34,
  languages: 18,
  salary_expectation: 16,
  notice_period: 14,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Candidates')

  ws.columns = IMPORT_FIELDS.map((f) => ({
    header: f,
    key: f,
    width: WIDTHS[f] ?? 14,
  }))
  ws.addRow(EXAMPLE)

  // Bold, frozen header row so it stays visible while editing.
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="hrhandle-candidates-template.xlsx"',
    },
  })
}

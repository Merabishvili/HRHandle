import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { csvCell } from '@/lib/csv'

function esc(value: string | null | undefined): string {
  return csvCell(value)
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return ''
  return date.slice(0, 7) // "YYYY-MM"
}

function fmtYear(year: number | null | undefined): string {
  return year ? String(year) : ''
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = profile.organization_id

  const [{ data: candidatesRaw }, { data: experienceRaw }, { data: educationRaw }, { data: statusesRaw }] =
    await Promise.all([
      supabase
        .from('candidates')
        .select('id, first_name, last_name, email, phone, linkedin_profile_url, location, timezone, languages, salary_expectation, notice_period, source, general_status_id, created_at, updated_at')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10000),
      supabase
        .from('candidate_experience')
        .select('candidate_id, company, title, start_date, end_date, is_current')
        .eq('organization_id', orgId)
        .order('start_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('candidate_education')
        .select('candidate_id, institution, degree, field_of_study, start_year, end_year, is_ongoing')
        .eq('organization_id', orgId)
        .order('start_year', { ascending: false, nullsFirst: false }),
      supabase
        .from('candidate_statuses')
        .select('id, name'),
    ])

  const candidates = candidatesRaw ?? []
  const experience = experienceRaw ?? []
  const education = educationRaw ?? []
  const statusMap = Object.fromEntries((statusesRaw ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

  // Group experience and education by candidate_id
  const expByCandidateId: Record<string, typeof experience> = {}
  for (const e of experience) {
    ;(expByCandidateId[e.candidate_id] ??= []).push(e)
  }
  const eduByCandidateId: Record<string, typeof education> = {}
  for (const e of education) {
    ;(eduByCandidateId[e.candidate_id] ??= []).push(e)
  }

  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'LinkedIn',
    'Location',
    'Timezone',
    'Languages',
    'Salary Expectation',
    'Notice Period',
    'Source',
    'Status',
    'Experience',
    'Education',
    'Added',
    'Updated',
  ]

  const rows = candidates.map((c) => {
    const expEntries = (expByCandidateId[c.id] ?? []).map((e) => {
      const range = e.is_current
        ? `${fmtDate(e.start_date)} – present`
        : `${fmtDate(e.start_date)}${e.end_date ? ` – ${fmtDate(e.end_date)}` : ''}`
      return `${e.title} at ${e.company}${range ? ` (${range})` : ''}`
    })

    const eduEntries = (eduByCandidateId[c.id] ?? []).map((e) => {
      const parts = [e.degree, e.field_of_study].filter(Boolean).join(' in ')
      const range = e.is_ongoing
        ? `${fmtYear(e.start_year)} – present`
        : `${fmtYear(e.start_year)}${e.end_year ? ` – ${fmtYear(e.end_year)}` : ''}`
      return `${parts ? `${parts}, ` : ''}${e.institution}${range ? ` (${range})` : ''}`
    })

    return [
      esc(c.first_name),
      esc(c.last_name),
      esc(c.email),
      esc(c.phone),
      esc(c.linkedin_profile_url),
      esc(c.location),
      esc(c.timezone),
      esc(Array.isArray(c.languages) ? c.languages.join('; ') : (c.languages ?? '')),
      esc(c.salary_expectation),
      esc(c.notice_period),
      esc(c.source),
      esc(c.general_status_id ? (statusMap[c.general_status_id] ?? '') : ''),
      esc(expEntries.join(' | ')),
      esc(eduEntries.join(' | ')),
      c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : '',
      c.updated_at ? new Date(c.updated_at).toISOString().slice(0, 10) : '',
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="candidates.csv"',
    },
  })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
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

  const { data: candidates } = await supabase
    .from('candidates')
    .select('first_name, last_name, email, phone, current_company, current_position, years_of_experience, source, linkedin_profile_url, created_at')
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const rows = candidates || []

  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Position', 'Years Experience', 'Source', 'LinkedIn', 'Added']

  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        csvEscape(r.first_name || ''),
        csvEscape(r.last_name || ''),
        csvEscape(r.email || ''),
        csvEscape(r.phone || ''),
        csvEscape(r.current_company || ''),
        csvEscape(r.current_position || ''),
        r.years_of_experience ?? '',
        csvEscape(r.source || ''),
        csvEscape(r.linkedin_profile_url || ''),
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      ].join(',')
    ),
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="candidates.csv"',
    },
  })
}

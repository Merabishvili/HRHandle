import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vacancyId = searchParams.get('vacancy_id')

  if (!vacancyId) {
    return NextResponse.json({ error: 'vacancy_id is required' }, { status: 400 })
  }

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

  // Verify the vacancy belongs to this org
  const { data: vacancy } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('id', vacancyId)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single()

  if (!vacancy) {
    return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 })
  }

  const { data: applications } = await supabase
    .from('applications')
    .select('candidate_id, status_id, applied_at, source_type, application_statuses(name)')
    .eq('organization_id', profile.organization_id)
    .eq('vacancy_id', vacancyId)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })
    .limit(10000)

  const candidateIds = [...new Set((applications || []).map((a) => a.candidate_id))]
  const candidateMap = new Map<string, { first_name: string; last_name: string; email: string | null; phone: string | null; linkedin_profile_url: string | null }>()

  if (candidateIds.length > 0) {
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, email, phone, linkedin_profile_url')
      .in('id', candidateIds)
      .is('deleted_at', null)

    for (const c of candidates || []) {
      candidateMap.set(c.id, c)
    }
  }

  const rows = applications || []

  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'LinkedIn', 'Application Status', 'Source', 'Applied At']

  type AppStatusJoin = { name: string } | { name: string }[] | null

  const csv = [
    headers.join(','),
    ...rows.map((r) => {
      const c = candidateMap.get(r.candidate_id)
      const statusJoin = r.application_statuses as AppStatusJoin
      const statusName = Array.isArray(statusJoin) ? statusJoin[0]?.name : statusJoin?.name
      return [
        csvEscape(c?.first_name || ''),
        csvEscape(c?.last_name || ''),
        csvEscape(c?.email || ''),
        csvEscape(c?.phone || ''),
        csvEscape(c?.linkedin_profile_url || ''),
        csvEscape(statusName || ''),
        csvEscape(r.source_type || ''),
        r.applied_at ? new Date(r.applied_at).toISOString().slice(0, 10) : '',
      ].join(',')
    }),
  ].join('\r\n')

  const safeTitle = vacancy.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="applications_${safeTitle}.csv"`,
    },
  })
}

'use server'

import { createClient } from '@/lib/supabase/server'

/** Richer per-candidate data surfaced in the Pipeline Review Mode card but not
 * carried on the lightweight kanban payload. Fetched lazily per candidate as
 * the recruiter navigates the queue (the queue is small — new applications
 * only — so this stays cheap). */
export interface ReviewCandidateDetail {
  location: string | null
  languages: string[]
  yearsOfExperience: number | null
  salaryExpectation: string | null
  noticePeriod: string | null
  /** Latest CV/resume document, if one is on file. Opened via
   * getDocumentSignedUrl(id) — we never expose the storage path here. */
  cvDocument: { id: string; fileName: string } | null
}

export async function getReviewCandidateDetail(
  candidateId: string,
): Promise<{ success: true; data: ReviewCandidateDetail } | { success: false; error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // RLS scopes both reads to the caller's organization.
  const [{ data: candidate, error: candErr }, { data: docs }] = await Promise.all([
    supabase
      .from('candidates')
      .select('location, languages, years_of_experience, salary_expectation, notice_period')
      .eq('id', candidateId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('candidate_documents')
      .select('id, file_name, document_type, created_at')
      .eq('candidate_id', candidateId)
      .in('document_type', ['cv', 'resume'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (candErr || !candidate) {
    return { success: false, error: 'Candidate not found' }
  }

  const cv = (docs ?? [])[0] as { id: string; file_name: string } | undefined

  // `years_of_experience` is NUMERIC(4,1) — PostgREST may hand it back as a
  // string, so coerce rather than gate on `typeof === 'number'`.
  const rawYears = candidate.years_of_experience
  const years = rawYears == null ? null : Number(rawYears)

  return {
    success: true,
    data: {
      location: candidate.location ?? null,
      languages: Array.isArray(candidate.languages) ? candidate.languages : [],
      yearsOfExperience: years !== null && Number.isFinite(years) ? years : null,
      salaryExpectation: candidate.salary_expectation ?? null,
      noticePeriod: candidate.notice_period ?? null,
      cvDocument: cv ? { id: cv.id, fileName: cv.file_name } : null,
    },
  }
}

/** Everything the InterviewForm needs, fetched on demand when the Review Mode
 * "Schedule" overlay opens — mirrors what `/interviews/new` loads server-side
 * so the same form can render inside the overlay without navigating away. */
export interface InterviewFormData {
  candidates: { id: string; first_name: string; last_name: string; email: string | null }[]
  vacancies: { id: string; title: string }[]
  applications: { id: string; candidate_id: string; vacancy_id: string }[]
  teamMembers: { id: string; full_name: string; email: string | null }[]
  currentUserId: string
  hasGoogleCalendar: boolean
  hasZoom: boolean
  hasMicrosoft: boolean
  defaultMeetingProvider: 'google_meet' | 'zoom' | 'teams' | null
}

export async function getInterviewFormData(): Promise<
  { success: true; data: InterviewFormData } | { success: false; error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, google_refresh_token, zoom_refresh_token, microsoft_refresh_token, default_meeting_provider')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { success: false, error: 'No organization' }
  const orgId = profile.organization_id

  const [{ data: candidatesRaw }, { data: vacanciesRaw }, { data: applicationsRaw }, { data: teamRaw }] =
    await Promise.all([
      supabase
        .from('candidates')
        .select('id, first_name, last_name, email')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('first_name', { ascending: true }),
      supabase
        .from('vacancies')
        .select('id, title, status_id, vacancy_statuses ( code )')
        .eq('organization_id', orgId)
        .is('archived_at', null)
        .is('deleted_at', null)
        .order('title', { ascending: true }),
      supabase
        .from('applications')
        .select('id, candidate_id, vacancy_id')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', orgId)
        .order('full_name', { ascending: true }),
    ])

  // Only open/draft vacancies can take a new interview, mirroring /interviews/new.
  const vacancies = ((vacanciesRaw ?? []) as {
    id: string
    title: string
    vacancy_statuses: { code: string }[] | { code: string } | null
  }[])
    .filter((v) => {
      const s = Array.isArray(v.vacancy_statuses) ? v.vacancy_statuses[0] : v.vacancy_statuses
      return s?.code === 'open' || s?.code === 'draft'
    })
    .map((v) => ({ id: v.id, title: v.title }))

  return {
    success: true,
    data: {
      candidates: (candidatesRaw ?? []) as InterviewFormData['candidates'],
      vacancies,
      applications: (applicationsRaw ?? []) as InterviewFormData['applications'],
      teamMembers: (teamRaw ?? []) as InterviewFormData['teamMembers'],
      currentUserId: user.id,
      hasGoogleCalendar: !!profile.google_refresh_token,
      hasZoom: !!profile.zoom_refresh_token,
      hasMicrosoft: !!profile.microsoft_refresh_token,
      defaultMeetingProvider:
        (profile.default_meeting_provider as 'google_meet' | 'zoom' | 'teams' | null) ?? null,
    },
  }
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CandidateCreateWizard } from '@/components/candidates/wizard/candidate-create-wizard'
import { getApplicationStatuses } from '@/lib/cache/lookups'
import { getCustomFieldSchema } from '@/lib/actions/custom-fields'

/**
 * Wave 2.7 — wizard host for /candidates/new per Create Candidate
 * Steps.dc.html. Server component fetches the data the wizard needs
 * (open vacancies + non-terminal application stages for the starting-
 * stage picker), and renders the client-side `CandidateCreateWizard`.
 *
 * The previous single-page form (`CandidateForm`) lives on at
 * /candidates/[id]/edit until the edit flow is migrated.
 */
export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ vacancy?: string }>
}) {
  const { vacancy: defaultVacancyId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/pipeline')
  }

  const organizationId = profile.organization_id

  // Pull open vacancies (so the wizard's "Initial vacancy" picker shows
  // only roles a recruiter can sensibly drop a candidate into) plus the
  // full application-status list. We filter the stages to non-terminal
  // codes server-side so the wizard never has to deal with hired /
  // rejected / withdrawn — those aren't valid starting stages.
  const [{ data: vacancies }, applicationStatusesAll, customFieldGroups] = await Promise.all([
    supabase
      .from('vacancies')
      .select('id, title, application_statuses:status_id(code)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('title'),
    getApplicationStatuses(),
    getCustomFieldSchema('candidate'),
  ])

  // Non-terminal stages for the starting-stage picker. The order is
  // already enforced by sort_order in the lookup cache.
  const TERMINAL = new Set(['hired', 'rejected', 'withdrawn'])
  const startingStages = (applicationStatusesAll || [])
    .filter((s) => s.is_active && !TERMINAL.has(s.code))
    .map((s) => ({ id: s.id, code: s.code, name: s.name }))

  return (
    <div className="mx-auto max-w-5xl">
      <CandidateCreateWizard
        vacancies={(vacancies || []).map((v) => ({ id: v.id, title: v.title }))}
        defaultVacancyId={defaultVacancyId ?? null}
        startingStages={startingStages}
        customFieldGroups={customFieldGroups}
      />
    </div>
  )
}

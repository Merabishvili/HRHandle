import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export interface SubmittedScoreRow {
  application_id: string
  score: number | null
}

/**
 * Scores of the SUBMITTED assessments for these applications — what the Fit
 * pill averages on the pipeline boards and the candidates list.
 *
 * Read with the service role, scoped to the caller's organization: the
 * database hides a colleague's assessment from members until they've
 * submitted their own (`20261012_assessment_visibility_rls.sql`), but the Fit
 * average is shown to everyone — it reveals no one's answers.
 */
export async function submittedAssessmentScores(
  orgId: string,
  applicationIds: string[],
): Promise<SubmittedScoreRow[]> {
  if (applicationIds.length === 0) return []
  const { data, error } = await createAdminClient()
    .from('candidate_evaluations')
    .select('application_id, score')
    .eq('organization_id', orgId)
    .eq('submitted', true)
    .in('application_id', applicationIds)
  if (error) console.error('[fit-scores] reading assessment scores failed:', error.message)
  return (data ?? []) as SubmittedScoreRow[]
}

/**
 * How many OTHER people have submitted an assessment for this application —
 * the assessment sheet says so while their cards are still hidden from you.
 * Service role for the same reason as above; counts only, no content.
 */
export async function otherSubmittedAssessmentCount(
  orgId: string,
  applicationId: string,
  viewerId: string,
): Promise<number> {
  const { count, error } = await createAdminClient()
    .from('candidate_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('application_id', applicationId)
    .eq('submitted', true)
    .or(`reviewer_id.is.null,reviewer_id.neq.${viewerId}`)
  if (error) console.error('[fit-scores] counting assessments failed:', error.message)
  return count ?? 0
}

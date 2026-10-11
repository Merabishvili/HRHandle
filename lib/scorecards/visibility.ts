/**
 * Who may read which submitted assessments on a candidate profile.
 *
 * Interviewers write their assessment without seeing anyone else's (the
 * assessment sheet hides them), so the profile's "Assessments" record follows
 * the same rule: a teammate sees other people's assessments for an
 * application only after submitting their own for it. The owner and admins —
 * who make the hiring decision — always see all of them.
 */
export interface AssessmentVisibilityRow {
  application_id: string
  reviewer_id: string | null
}

export function visibleAssessments<T extends AssessmentVisibilityRow>(
  rows: T[],
  viewerId: string,
  viewerIsAdmin: boolean,
): T[] {
  if (viewerIsAdmin) return rows
  const submittedByViewer = new Set(rows.filter((r) => r.reviewer_id === viewerId).map((r) => r.application_id))
  return rows.filter((r) => r.reviewer_id === viewerId || submittedByViewer.has(r.application_id))
}

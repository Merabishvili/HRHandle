import type { TemplateType } from '@/lib/email-template-utils'
import type { StatusChangeStage } from '@/lib/email'

// Pure decision function used by `updateApplicationStatus`. Decides whether a
// given status transition is one we'd auto-email the candidate about, and
// returns the matching stage/template-type pair if so.
//
// Gating rules:
//   1. The target status must be one we explicitly email about. Today that's
//      `screening` and `interview` only. Hire, offer, rejection, withdrawn,
//      and the initial `applied` status all bypass this path — they're either
//      handled elsewhere (rejection) or intentionally recruiter-driven.
//   2. The transition must be a real change (before !== after).
//   3. The transition must be forward in the pipeline — moving an application
//      backward (e.g. interview → screening to fix a misclick) should not
//      re-fire the email. We use the application_statuses.sort_order column
//      for this; when ordering is unknown (both nulls) we assume forward and
//      let the transition through rather than silently dropping.
//
// This function does NOT check whether the org has opted in (that's a database
// lookup in the caller). It also doesn't check the candidate's email — the
// caller must do that before sending.

const STAGE_BY_CODE: Record<string, { stage: StatusChangeStage; type: TemplateType }> = {
  screening: { stage: 'screening', type: 'status_change_screening' },
  interview: { stage: 'interview', type: 'status_change_interview' },
}

export interface TransitionDecision {
  stage: StatusChangeStage
  type: TemplateType
}

export function shouldEmailForTransition(
  beforeCode: string | null | undefined,
  afterCode: string | null | undefined,
  beforeSortOrder: number | null | undefined,
  afterSortOrder: number | null | undefined,
): TransitionDecision | null {
  if (!afterCode) return null
  if (beforeCode === afterCode) return null

  const target = STAGE_BY_CODE[afterCode]
  if (!target) return null

  const haveBoth =
    typeof beforeSortOrder === 'number' && typeof afterSortOrder === 'number'
  if (haveBoth && afterSortOrder <= beforeSortOrder) return null

  return target
}

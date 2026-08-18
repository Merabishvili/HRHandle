import type { ApplicationStatus } from '@/lib/types/application'
import type { CrossVacancyCardData } from './cross-vacancy-card'

/**
 * Pure data-derivation helpers for the cross-vacancy board (A-201). Extracted
 * from `cross-vacancy-board.tsx` so the role-filter / card-shaping / grouping /
 * terminal-count / review-queue logic can be unit-tested without rendering the
 * stateful board. The component's `useMemo`s now just call these.
 */

export interface CrossVacancyApplication {
  id: string
  candidate_id: string
  status_id: string | null
  first_name: string
  last_name: string
  /** Candidate email — used by BulkBar's Email action to build a
   * mailto:bcc=… link. Null when the candidate has no email on file. */
  email: string | null
  current_position: string | null
  current_company: string | null
  last_status_changed_at: string | null
  applied_at: string
  vacancy_id: string
  vacancy_title: string
  /** Short source label ("LinkedIn", "Apply link", etc.) threaded from
   * candidates.source. Null when the recruiter never set it. */
  source: string | null
  /** Optional 0-10 fit score from the most recent candidate_evaluation —
   * surfaced as a pill on compact-density cards. */
  fit_score: number | null
  /** Name of the rejection reason stamped on the application (rejected apps
   * only). Surfaced in the collapsed terminal rail's expanded list. */
  rejection_reason: string | null
}

/** Codes whose candidates are out of the active pipeline. */
export const TERMINAL_CODES: ReadonlySet<ApplicationStatus['code']> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

/** Role-filter: no selection (or all roles) → everything; else the union of the
 * selected vacancy ids. */
export function filterApplicationsByRole(
  applications: CrossVacancyApplication[],
  roleFilter: string[],
  roleCount: number,
): CrossVacancyApplication[] {
  if (roleFilter.length === 0 || roleFilter.length === roleCount) {
    return applications
  }
  const allow = new Set(roleFilter)
  return applications.filter((a) => allow.has(a.vacancy_id))
}

/** Shape each application into the card model the board/list render. */
export function buildCardData(
  applications: CrossVacancyApplication[],
  statusById: Map<string, ApplicationStatus>,
  activeStatuses: ApplicationStatus[],
): CrossVacancyCardData[] {
  return applications.map((a) => {
    const status = a.status_id ? statusById.get(a.status_id) : null
    return {
      applicationId: a.id,
      candidateId: a.candidate_id,
      firstName: a.first_name,
      lastName: a.last_name,
      vacancyTitle: a.vacancy_title,
      currentPosition: a.current_position,
      source: a.source,
      inStageSince: a.last_status_changed_at ?? a.applied_at,
      appliedAt: a.applied_at,
      stageCode: status?.code ?? activeStatuses[0]?.code ?? 'applied',
      fitScore: a.fit_score,
      rejectionReason: a.rejection_reason,
    }
  })
}

/** Bucket cards by their stage code (the board's column model). */
export function groupCardsByStageCode(
  cardData: CrossVacancyCardData[],
): Map<string, CrossVacancyCardData[]> {
  const m = new Map<string, CrossVacancyCardData[]>()
  for (const c of cardData) {
    const arr = m.get(c.stageCode) ?? []
    arr.push(c)
    m.set(c.stageCode, arr)
  }
  return m
}

export interface TerminalCount {
  statusId: string
  code: ApplicationStatus['code']
  name: string
  count: number
}

/** Per-terminal-stage counts for the collapsed terminal rail. */
export function buildTerminalCounts(
  terminalStatuses: ApplicationStatus[],
  applications: CrossVacancyApplication[],
): TerminalCount[] {
  return terminalStatuses.map((s) => ({
    statusId: s.id,
    code: s.code,
    name: s.name,
    count: applications.filter((a) => a.status_id === s.id).length,
  }))
}

export interface ClosedCandidate {
  applicationId: string
  candidateId: string
  name: string
  vacancyTitle: string
  code: ApplicationStatus['code']
  reason: string | null
  inStageSince: string
}

/** Rejected/withdrawn candidates listed in the expanded terminal rail. */
export function buildClosedCandidates(
  applications: CrossVacancyApplication[],
  statusById: Map<string, ApplicationStatus>,
): ClosedCandidate[] {
  return applications
    .map((a) => {
      const status = a.status_id ? statusById.get(a.status_id) : null
      if (!status || !['rejected', 'withdrawn'].includes(status.code)) return null
      return {
        applicationId: a.id,
        candidateId: a.candidate_id,
        name: `${a.first_name} ${a.last_name}`.trim(),
        vacancyTitle: a.vacancy_title,
        code: status.code,
        reason: a.rejection_reason,
        inStageSince: a.last_status_changed_at ?? a.applied_at,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
}

/** Count of non-terminal applications (header "N active candidates"). */
export function countActiveApplications(
  applications: CrossVacancyApplication[],
  statusById: Map<string, ApplicationStatus>,
): number {
  return applications.filter((a) => {
    const status = a.status_id ? statusById.get(a.status_id) : null
    return status && !TERMINAL_CODES.has(status.code)
  }).length
}

/** Fresh, never-touched (no last_status_changed_at), non-terminal applications,
 * oldest first — the Quick Review queue. */
export function buildReviewQueue(
  applications: CrossVacancyApplication[],
  statusById: Map<string, ApplicationStatus>,
): CrossVacancyApplication[] {
  return applications
    .filter((a) => {
      const status = a.status_id ? statusById.get(a.status_id) : null
      if (!status || TERMINAL_CODES.has(status.code)) return false
      return !a.last_status_changed_at
    })
    .sort(
      (a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime(),
    )
}

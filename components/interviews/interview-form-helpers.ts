import { toDisplayFullName } from '@/lib/format-name'

export interface InterviewCandidateOption {
  id: string
  first_name: string
  last_name: string
  email?: string | null
}

export interface InterviewVacancyOption {
  id: string
  title: string
}

export interface InterviewApplicationOption {
  id: string
  candidate_id: string
  vacancy_id: string
}

export interface InterviewTeamMemberOption {
  id: string
  full_name: string
  /** Used to exclude a candidate who is also a team member (internal
   * applicant) from the interviewer picker. */
  email?: string | null
}

export interface InterviewFormProps {
  candidates: InterviewCandidateOption[]
  vacancies: InterviewVacancyOption[]
  applications: InterviewApplicationOption[]
  teamMembers: InterviewTeamMemberOption[]
  defaultCandidateId?: string | undefined
  defaultVacancyId?: string | undefined
  defaultApplicationId?: string | undefined
  /** Pre-selected interviewer (defaults to the current user on the New
   * Interview page). The interviewer is always a team member — candidates
   * are never in this list. */
  defaultInterviewerId?: string | undefined
  hasGoogleCalendar?: boolean | undefined
  hasZoom?: boolean | undefined
  hasMicrosoft?: boolean | undefined
  /** The user's saved default auto meeting link (#6b) — prefers this provider
   * when it's connected. */
  defaultMeetingProvider?: 'google_meet' | 'zoom' | 'teams' | null
  /** When set, the form is rendered inside an overlay (e.g. Pipeline Review
   * Mode). On a successful create it calls this instead of navigating to
   * /interviews, so the caller can close the overlay and stay in place. */
  onScheduled?: (() => void) | undefined
  /** Overlay callers provide their own dismiss; falls back to navigating to
   * /interviews when absent (the standalone page). */
  onCancel?: (() => void) | undefined
}

export function getCandidateFullName(candidate: InterviewCandidateOption): string {
  // Display casing only (some names are stored ALL-CAPS); see lib/format-name.
  return toDisplayFullName(candidate.first_name, candidate.last_name)
}

/**
 * Team members eligible to be the interviewer for the selected candidate.
 *
 * A member who IS the selected candidate (same email — an internal applicant)
 * is dropped so you can't pick the interviewee as their own interviewer. But
 * the current user (`currentUserId`, the default interviewer) is NEVER dropped:
 * without that exemption, a recruiter testing with a candidate that shares
 * their own email — or a single-member org — ends up with an EMPTY picker that
 * shows only "Not assigned" (#10).
 */
export function eligibleInterviewers(
  teamMembers: InterviewTeamMemberOption[],
  candidateEmail: string | null | undefined,
  currentUserId: string | null | undefined,
): InterviewTeamMemberOption[] {
  const candEmail = candidateEmail?.trim().toLowerCase()
  if (!candEmail) return teamMembers
  return teamMembers.filter(
    (m) => m.id === currentUserId || (m.email ?? '').trim().toLowerCase() !== candEmail,
  )
}

/** Prefer auto-generated links when a calendar is connected; manual is the
 * fallback only when nothing is connected. Honours the user's saved
 * "default for video interviews" (#6b) when that provider is connected,
 * otherwise falls back to the built-in Google > Zoom > Teams order. */
export function defaultMeetingOption(
  hasGoogle: boolean,
  hasZoom: boolean,
  hasTeams: boolean,
  preferred?: 'google_meet' | 'zoom' | 'teams' | null,
): 'manual' | 'google_meet' | 'zoom' | 'teams' {
  if (preferred === 'google_meet' && hasGoogle) return 'google_meet'
  if (preferred === 'zoom' && hasZoom) return 'zoom'
  if (preferred === 'teams' && hasTeams) return 'teams'
  if (hasGoogle) return 'google_meet'
  if (hasZoom) return 'zoom'
  if (hasTeams) return 'teams'
  return 'manual'
}

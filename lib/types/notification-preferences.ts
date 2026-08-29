/**
 * Type definitions for per-user notification preferences
 * (Wave 1.2 / Phase 0.7, extended in A-7 to the design's
 * event × channel matrix). Mirrors the JSONB shape stored on
 * `profiles.notification_preferences` introduced in Migration 045.
 *
 * Shape is additive — older rows that only carry `email`, `in_product`,
 * and `quiet_hours` still validate because every new key has a default
 * applied by `normalizeNotificationPreferences`.
 */

export interface NotificationEmailPreferences {
  new_applicant: boolean
  stage_change: boolean
  interview_scheduled: boolean
  offer_awaiting_response: boolean
  mention: boolean
  team_invite_update: boolean
  weekly_digest: boolean
}

export interface NotificationInAppEventPreferences {
  new_applicant: boolean
  stage_change: boolean
  interview_reminder: boolean
  offer_response: boolean
  // @mention in-app is locked on per design; kept in the type so the
  // matrix renders uniformly, but the form disables the checkbox.
  mention: boolean
}

export interface NotificationSlackEventPreferences {
  new_applicant: boolean
  stage_change: boolean
  interview_reminder: boolean
  offer_response: boolean
  mention: boolean
}

export interface NotificationInProductPreferences {
  show_bell_badge: boolean
  auto_mark_read: boolean
}

/**
 * v1.1 — when populated the dispatcher should skip email delivery during
 * the recipient's local quiet window. v1 stores null and the dispatcher
 * ignores it.
 */
export interface NotificationQuietHours {
  start_local: string // "HH:MM"
  end_local: string   // "HH:MM"
  timezone: string    // IANA — e.g. "Europe/Tbilisi"
}

export interface NotificationPreferences {
  email: NotificationEmailPreferences
  in_app_events: NotificationInAppEventPreferences
  slack_events: NotificationSlackEventPreferences
  in_product: NotificationInProductPreferences
  quiet_hours: NotificationQuietHours | null
}

// Email notifications are OFF by default and in-app ON by default (the org
// opts into email per event). Emails are always sent instantly — there is no
// digest.
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    new_applicant: false,
    stage_change: false,
    interview_scheduled: false,
    offer_awaiting_response: false,
    mention: false,
    team_invite_update: false,
    weekly_digest: false,
  },
  in_app_events: {
    new_applicant: true,
    stage_change: true,
    interview_reminder: true,
    offer_response: true,
    mention: true,
  },
  slack_events: {
    new_applicant: false,
    stage_change: false,
    interview_reminder: false,
    offer_response: false,
    mention: false,
  },
  in_product: {
    show_bell_badge: true,
    auto_mark_read: true,
  },
  quiet_hours: null,
}

/**
 * Maps a notification `type` (see lib/notifications/render.ts) to the
 * preference keys that gate its delivery. Used by createOrgNotifications:
 *   - in-app: skipped for a recipient who turned the matching toggle off
 *     (`inAppLocked` types can't be turned off; types with no matching
 *     toggle are always delivered in-app).
 *   - email: sent only when the matching email toggle is on (types with no
 *     email key are never emailed).
 */
export const NOTIFICATION_TYPE_PREFS: Record<
  string,
  {
    inApp?: keyof NotificationInAppEventPreferences
    email?: keyof NotificationEmailPreferences
    inAppLocked?: boolean
  }
> = {
  new_application: { inApp: 'new_applicant', email: 'new_applicant' },
  interview_scheduled: { inApp: 'interview_reminder', email: 'interview_scheduled' },
  interview_reminder: { inApp: 'interview_reminder', email: 'interview_scheduled' },
  candidate_hired: { inApp: 'stage_change', email: 'stage_change' },
  application_withdrawn: { inApp: 'stage_change', email: 'stage_change' },
  offer_accepted: { inApp: 'offer_response', email: 'offer_awaiting_response' },
  offer_declined: { inApp: 'offer_response', email: 'offer_awaiting_response' },
  note_mention: { inApp: 'mention', email: 'mention', inAppLocked: true },
  team_invite_sent: { email: 'team_invite_update' },
  ai_fit_ready: {},
  plan_limit_reached: {},
}

/** Whether a recipient should get the in-app notification for this type. */
export function inAppNotificationAllowed(prefs: NotificationPreferences, type: string): boolean {
  const m = NOTIFICATION_TYPE_PREFS[type]
  if (!m || m.inApp === undefined) return true // no matching toggle → always in-app
  if (m.inAppLocked) return true
  return prefs.in_app_events[m.inApp]
}

/** Whether a recipient should be emailed for this type. */
export function emailNotificationAllowed(prefs: NotificationPreferences, type: string): boolean {
  const m = NOTIFICATION_TYPE_PREFS[type]
  if (!m || m.email === undefined) return false // no email pref → never email
  return prefs.email[m.email]
}

export const EMAIL_EVENT_LABELS: Record<keyof NotificationEmailPreferences, { title: string; description: string }> = {
  new_applicant: {
    title: 'New applicant on my vacancies',
    description: 'Email me when someone applies to a role I own.',
  },
  stage_change: {
    title: 'Stage change',
    description: 'A candidate I follow moves to a new stage.',
  },
  interview_scheduled: {
    title: 'Interview scheduled with me',
    description: "Email me when I'm added to an interview as the interviewer.",
  },
  offer_awaiting_response: {
    title: 'Offer awaiting reply',
    description: "Alert me when an offer I sent is going stale.",
  },
  mention: {
    title: '@mention in a candidate note',
    description: 'Email me when a teammate @-mentions me.',
  },
  team_invite_update: {
    title: 'Team invitation update',
    description: 'Email me when someone accepts or declines an invitation I sent.',
  },
  weekly_digest: {
    title: 'Weekly digest',
    description: 'A Monday morning summary of pipeline activity across the org.',
  },
}

export const IN_PRODUCT_LABELS: Record<keyof NotificationInProductPreferences, { title: string; description: string }> = {
  show_bell_badge: {
    title: 'Show notification bell badge',
    description: 'Display the unread count on the topbar bell.',
  },
  auto_mark_read: {
    title: 'Auto-mark as read on click',
    description: 'Mark notifications as read when you click to open them.',
  },
}

/**
 * Events rendered as rows in the Notifications matrix (A-7).
 * Each row groups the three channel toggles for the same event.
 *
 * `emailKey` and `inAppKey` / `slackKey` keep the matrix rows mapped to
 * the underlying flat objects so dispatcher code can still consult a
 * single `email.new_applicant` or `in_app_events.new_applicant`.
 */
export type MatrixEvent =
  | 'new_applicant'
  | 'stage_change'
  | 'interview_reminder'
  | 'offer_response'
  | 'mention'

export interface MatrixEventMeta {
  key: MatrixEvent
  title: string
  description: string
  emailKey: keyof NotificationEmailPreferences
  inAppKey: keyof NotificationInAppEventPreferences
  slackKey: keyof NotificationSlackEventPreferences
  inAppLocked?: boolean // @mention can't be disabled in-app
}

export const MATRIX_EVENTS: MatrixEventMeta[] = [
  {
    key: 'new_applicant',
    title: 'New application',
    description: 'Someone applies to a role you own',
    emailKey: 'new_applicant',
    inAppKey: 'new_applicant',
    slackKey: 'new_applicant',
  },
  {
    key: 'stage_change',
    title: 'Stage change',
    description: 'A candidate you follow moves stage',
    emailKey: 'stage_change',
    inAppKey: 'stage_change',
    slackKey: 'stage_change',
  },
  {
    key: 'interview_reminder',
    title: 'Interview reminder',
    description: 'Ahead of an upcoming interview',
    emailKey: 'interview_scheduled',
    inAppKey: 'interview_reminder',
    slackKey: 'interview_reminder',
  },
  {
    key: 'offer_response',
    title: 'Offer response',
    description: 'A candidate accepts or declines an offer',
    emailKey: 'offer_awaiting_response',
    inAppKey: 'offer_response',
    slackKey: 'offer_response',
  },
  {
    key: 'mention',
    title: '@mention in a note',
    description: 'A teammate mentions you',
    emailKey: 'mention',
    inAppKey: 'mention',
    slackKey: 'mention',
    inAppLocked: true,
  },
]

/**
 * Merge stored prefs with defaults so a legacy row that only has
 * `email` / `in_product` / `quiet_hours` (the Migration 045 shape) gains
 * the new matrix keys with their design-mandated defaults. Without this,
 * the form would render undefined-state checkboxes for stored profiles.
 */
export function normalizeNotificationPreferences(
  stored: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  const d = DEFAULT_NOTIFICATION_PREFERENCES
  if (!stored) return d
  return {
    email: { ...d.email, ...(stored.email ?? {}) },
    in_app_events: { ...d.in_app_events, ...(stored.in_app_events ?? {}) },
    slack_events: { ...d.slack_events, ...(stored.slack_events ?? {}) },
    in_product: { ...d.in_product, ...(stored.in_product ?? {}) },
    quiet_hours: stored.quiet_hours ?? d.quiet_hours,
  }
}

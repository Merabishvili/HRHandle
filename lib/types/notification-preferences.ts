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

export type EmailDelivery = 'instant' | 'daily'

export interface NotificationPreferences {
  email: NotificationEmailPreferences
  in_app_events: NotificationInAppEventPreferences
  slack_events: NotificationSlackEventPreferences
  in_product: NotificationInProductPreferences
  email_delivery: EmailDelivery
  quiet_hours: NotificationQuietHours | null
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    new_applicant: true,
    stage_change: false,
    interview_scheduled: true,
    offer_awaiting_response: true,
    mention: true,
    team_invite_update: true,
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
  email_delivery: 'instant',
  quiet_hours: null,
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
    email_delivery: stored.email_delivery ?? d.email_delivery,
    quiet_hours: stored.quiet_hours ?? d.quiet_hours,
  }
}

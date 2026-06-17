/**
 * Type definitions for per-user notification preferences
 * (Wave 1.2 / Phase 0.7). Mirrors the JSONB shape stored on
 * `profiles.notification_preferences` introduced in Migration 045.
 */

export interface NotificationEmailPreferences {
  new_applicant: boolean
  interview_scheduled: boolean
  offer_awaiting_response: boolean
  mention: boolean
  team_invite_update: boolean
  weekly_digest: boolean
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
  in_product: NotificationInProductPreferences
  quiet_hours: NotificationQuietHours | null
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    new_applicant: true,
    interview_scheduled: true,
    offer_awaiting_response: true,
    mention: true,
    team_invite_update: true,
    weekly_digest: false,
  },
  in_product: {
    show_bell_badge: true,
    auto_mark_read: true,
  },
  quiet_hours: null,
}

export const EMAIL_EVENT_LABELS: Record<keyof NotificationEmailPreferences, { title: string; description: string }> = {
  new_applicant: {
    title: 'New applicant on my vacancies',
    description: 'Email me when someone applies to a role I own.',
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

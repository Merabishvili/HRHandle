import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EMAIL_EVENT_LABELS,
  IN_PRODUCT_LABELS,
  MATRIX_EVENTS,
  normalizeNotificationPreferences,
  type NotificationEmailPreferences,
  type NotificationInAppEventPreferences,
  type NotificationInProductPreferences,
  type NotificationPreferences,
  type NotificationSlackEventPreferences,
} from '@/lib/types/notification-preferences'

// These tests pin the shape of the notification_preferences JSONB column
// against Migration 045 + the A-7 matrix extension so a careless rename
// here doesn't drift the DEFAULT used by the server action away from the
// column DEFAULT.

describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
  it('matches the A-7 matrix shape', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
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
    })
  })

  it('opts into the design-mandated email events except stage_change + weekly_digest', () => {
    const opts = DEFAULT_NOTIFICATION_PREFERENCES.email
    expect(opts.new_applicant).toBe(true)
    expect(opts.interview_scheduled).toBe(true)
    expect(opts.offer_awaiting_response).toBe(true)
    expect(opts.mention).toBe(true)
    expect(opts.team_invite_update).toBe(true)
    expect(opts.stage_change).toBe(false)
    expect(opts.weekly_digest).toBe(false)
  })

  it('opts every matrix event into in-app by default (per design)', () => {
    const opts = DEFAULT_NOTIFICATION_PREFERENCES.in_app_events
    expect(opts.new_applicant).toBe(true)
    expect(opts.stage_change).toBe(true)
    expect(opts.interview_reminder).toBe(true)
    expect(opts.offer_response).toBe(true)
    expect(opts.mention).toBe(true)
  })

  it('opts every matrix event OUT of Slack by default (per design)', () => {
    const opts = DEFAULT_NOTIFICATION_PREFERENCES.slack_events
    for (const v of Object.values(opts)) {
      expect(v).toBe(false)
    }
  })

  it('opts into both in-product toggles by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_product.show_bell_badge).toBe(true)
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_product.auto_mark_read).toBe(true)
  })

  it('defaults email_delivery to instant', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.email_delivery).toBe('instant')
  })

  it('leaves quiet_hours null (deferred to v1.1)', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours).toBeNull()
  })
})

describe('EMAIL_EVENT_LABELS', () => {
  it('has a label entry for every NotificationEmailPreferences key', () => {
    const prefKeys = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.email) as (keyof NotificationEmailPreferences)[]
    const labelKeys = Object.keys(EMAIL_EVENT_LABELS)
    for (const k of prefKeys) {
      expect(labelKeys, `email pref ${k} missing label`).toContain(k)
    }
    // And there are no orphan labels for events that don't exist
    for (const k of labelKeys) {
      expect(prefKeys, `label ${k} has no matching pref`).toContain(k as keyof NotificationEmailPreferences)
    }
  })

  it('every label has a non-empty title and description', () => {
    for (const [key, meta] of Object.entries(EMAIL_EVENT_LABELS)) {
      expect(meta.title.trim().length, `title for ${key}`).toBeGreaterThan(0)
      expect(meta.description.trim().length, `description for ${key}`).toBeGreaterThan(0)
    }
  })
})

describe('IN_PRODUCT_LABELS', () => {
  it('has a label entry for every NotificationInProductPreferences key', () => {
    const prefKeys = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.in_product) as (keyof NotificationInProductPreferences)[]
    const labelKeys = Object.keys(IN_PRODUCT_LABELS)
    for (const k of prefKeys) {
      expect(labelKeys, `in-product pref ${k} missing label`).toContain(k)
    }
    for (const k of labelKeys) {
      expect(prefKeys, `label ${k} has no matching pref`).toContain(k as keyof NotificationInProductPreferences)
    }
  })

  it('every label has a non-empty title and description', () => {
    for (const [key, meta] of Object.entries(IN_PRODUCT_LABELS)) {
      expect(meta.title.trim().length, `title for ${key}`).toBeGreaterThan(0)
      expect(meta.description.trim().length, `description for ${key}`).toBeGreaterThan(0)
    }
  })
})

describe('MATRIX_EVENTS', () => {
  it('exposes the five design-mandated rows', () => {
    expect(MATRIX_EVENTS.map((e) => e.key)).toEqual([
      'new_applicant',
      'stage_change',
      'interview_reminder',
      'offer_response',
      'mention',
    ])
  })

  it('locks in-app for @mention only', () => {
    for (const event of MATRIX_EVENTS) {
      if (event.key === 'mention') {
        expect(event.inAppLocked).toBe(true)
      } else {
        expect(event.inAppLocked).toBeFalsy()
      }
    }
  })

  it('every row maps to existing email + in_app + slack keys', () => {
    for (const event of MATRIX_EVENTS) {
      expect(
        Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.email),
        `${event.key}.emailKey`,
      ).toContain(event.emailKey)
      expect(
        Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.in_app_events),
        `${event.key}.inAppKey`,
      ).toContain(event.inAppKey)
      expect(
        Object.keys(DEFAULT_NOTIFICATION_PREFERENCES.slack_events),
        `${event.key}.slackKey`,
      ).toContain(event.slackKey)
    }
  })
})

describe('normalizeNotificationPreferences', () => {
  it('returns defaults when nothing is stored', () => {
    expect(normalizeNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
    expect(normalizeNotificationPreferences(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
  })

  it('upgrades a Migration-045 row (only email + in_product + quiet_hours)', () => {
    const legacy = {
      email: {
        new_applicant: false,
        interview_scheduled: true,
        offer_awaiting_response: true,
        mention: true,
        team_invite_update: true,
        weekly_digest: false,
      } as NotificationEmailPreferences,
      in_product: {
        show_bell_badge: false,
        auto_mark_read: true,
      } as NotificationInProductPreferences,
      quiet_hours: null,
    }
    const normalized = normalizeNotificationPreferences(legacy)
    expect(normalized.email.new_applicant).toBe(false)
    expect(normalized.email.stage_change).toBe(false)
    expect(normalized.in_product.show_bell_badge).toBe(false)
    expect(normalized.in_app_events).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.in_app_events)
    expect(normalized.slack_events).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.slack_events)
    expect(normalized.email_delivery).toBe('instant')
  })

  it('preserves a fully-populated A-7 row verbatim', () => {
    const full: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      email: { ...DEFAULT_NOTIFICATION_PREFERENCES.email, new_applicant: false },
      slack_events: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.slack_events,
        new_applicant: true,
      } as NotificationSlackEventPreferences,
      in_app_events: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.in_app_events,
        stage_change: false,
      } as NotificationInAppEventPreferences,
      email_delivery: 'daily',
    }
    const normalized = normalizeNotificationPreferences(full)
    expect(normalized).toEqual(full)
  })

  it('fills missing channel objects but keeps the ones that exist', () => {
    const partial = {
      slack_events: {
        new_applicant: true,
        stage_change: false,
        interview_reminder: false,
        offer_response: true,
        mention: false,
      } as NotificationSlackEventPreferences,
    }
    const normalized = normalizeNotificationPreferences(partial)
    expect(normalized.slack_events.new_applicant).toBe(true)
    expect(normalized.slack_events.offer_response).toBe(true)
    expect(normalized.email).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.email)
    expect(normalized.in_app_events).toEqual(DEFAULT_NOTIFICATION_PREFERENCES.in_app_events)
  })
})

// Type-level satisfaction check — proves the const literal still
// inhabits NotificationPreferences without a runtime cast slipping in.
const _typecheck: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
void _typecheck

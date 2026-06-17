import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EMAIL_EVENT_LABELS,
  IN_PRODUCT_LABELS,
  type NotificationEmailPreferences,
  type NotificationInProductPreferences,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

// These tests pin the shape of the notification_preferences JSONB column
// against Migration 045 so a careless rename here doesn't drift the
// DEFAULT used by the server action away from the column DEFAULT.

describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
  it('matches Migration 045 column DEFAULT shape', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
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
    })
  })

  it('opts into all email events except the weekly digest', () => {
    const opts = DEFAULT_NOTIFICATION_PREFERENCES.email
    const enabled = Object.entries(opts).filter(([, v]) => v === true).map(([k]) => k)
    expect(enabled).toContain('new_applicant')
    expect(enabled).toContain('interview_scheduled')
    expect(enabled).toContain('offer_awaiting_response')
    expect(enabled).toContain('mention')
    expect(enabled).toContain('team_invite_update')
    expect(opts.weekly_digest).toBe(false)
  })

  it('opts into both in-product toggles by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_product.show_bell_badge).toBe(true)
    expect(DEFAULT_NOTIFICATION_PREFERENCES.in_product.auto_mark_read).toBe(true)
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

// Type-level satisfaction check — proves the const literal still
// inhabits NotificationPreferences without a runtime cast slipping in.
const _typecheck: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
void _typecheck

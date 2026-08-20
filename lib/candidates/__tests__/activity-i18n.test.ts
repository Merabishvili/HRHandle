import { describe, it, expect } from 'vitest'
import { activityHeadline, interviewTypeLabel } from '@/lib/candidates/activity-i18n'

/** A translator stub that echoes the key it was given (with interpolated values
 * appended). `.has` is always true so fallback-safe lookups take the localized
 * branch — we assert on which key/values were used, not on real copy. */
function makeT() {
  const t = ((key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key) as {
    (key: string, values?: Record<string, string | number>): string
    has: (key: string) => boolean
  }
  t.has = () => true
  return t
}

describe('interviewTypeLabel', () => {
  it('maps known interview types to their i18n key', () => {
    const t = makeT()
    expect(interviewTypeLabel(t, 'phone')).toBe('interviews.form.typePhone')
    expect(interviewTypeLabel(t, 'video')).toBe('interviews.form.typeVideo')
    expect(interviewTypeLabel(t, 'onsite')).toBe('interviews.form.typeOnsite')
  })

  it('capitalizes an unmapped type as a fallback', () => {
    expect(interviewTypeLabel(makeT(), 'zoom')).toBe('Zoom')
  })

  it('returns empty string for a missing type', () => {
    expect(interviewTypeLabel(makeT(), null)).toBe('')
  })
})

describe('activityHeadline', () => {
  const t = makeT()

  it('localizes an application headline from params', () => {
    expect(activityHeadline(t, 'application', 'Applied to X', { title: 'Engineer' })).toBe(
      'activity.appliedTo:Engineer',
    )
  })

  it('falls back to the English headline when params are missing (pre-migration)', () => {
    expect(activityHeadline(t, 'application', 'Applied to X', null)).toBe('Applied to X')
    expect(activityHeadline(t, 'document', 'Document uploaded: cv.pdf', undefined)).toBe(
      'Document uploaded: cv.pdf',
    )
  })

  it('always localizes a note (no params needed)', () => {
    expect(activityHeadline(t, 'note', 'Note added', null)).toBe('activity.noteAdded')
  })

  it('localizes a document headline from params', () => {
    expect(activityHeadline(t, 'document', 'x', { file: 'cv.pdf' })).toBe(
      'activity.documentUploaded:cv.pdf',
    )
  })

  it('localizes an interview headline with a translated type', () => {
    expect(activityHeadline(t, 'interview', 'x', { type: 'phone', at: '2026-01-01T10:00:00Z' })).toBe(
      'activity.interviewScheduled:interviews.form.typePhone',
    )
  })

  it('delegates stage rows to the audit-log localizer', () => {
    const out = activityHeadline(t, 'stage', 'Screening → Interview', {
      audit: true,
      action: 'status_changed',
      entity_type: 'application',
      details: { before: 'screening', after: 'interview' },
    })
    expect(out.startsWith('auditMsg.statusChanged')).toBe(true)
  })

  it('delegates offer rows to the audit-log localizer', () => {
    const out = activityHeadline(t, 'offer', 'Offer sent', {
      audit: true,
      action: 'offer_sent',
      entity_type: 'offer',
      details: {},
    })
    expect(out).toBe('auditMsg.action.offer_sent')
  })

  it('falls back to the English headline for an audit row without params', () => {
    expect(activityHeadline(t, 'stage', 'Screening → Interview', null)).toBe('Screening → Interview')
  })
})

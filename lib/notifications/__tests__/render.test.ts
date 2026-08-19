import { describe, it, expect } from 'vitest'
import { renderNotification } from '@/lib/notifications/render'

// Echo translator: renders "key|param=value" so we can assert key + params.
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}|${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')}` : key

describe('renderNotification', () => {
  it('falls back to stored English text for pre-migration rows (no data)', () => {
    const r = renderNotification(t, { type: 'new_application', data: null, title: 'New application: Ana B', body: 'Applied for Dev' })
    expect(r).toEqual({ title: 'New application: Ana B', body: 'Applied for Dev' })
  })

  it('localizes new_application from data', () => {
    const r = renderNotification(t, { type: 'new_application', data: { name: 'Ana B', vacancy: 'Dev' }, title: 'x', body: 'y' })
    expect(r.title).toBe('notif.newApplication.title|name=Ana B')
    expect(r.body).toBe('notif.forVacancy|vacancy=Dev')
  })

  it('omits the body when no vacancy is present', () => {
    const r = renderNotification(t, { type: 'interview_scheduled', data: { name: 'Ana' }, title: 'x', body: null })
    expect(r.title).toBe('notif.interviewScheduled.title|name=Ana')
    expect(r.body).toBeNull()
  })

  it('localizes no-param types (empty data object)', () => {
    expect(renderNotification(t, { type: 'offer_accepted', data: {}, title: 'x', body: null }).title).toBe('notif.offerAccepted.title')
    expect(renderNotification(t, { type: 'application_withdrawn', data: {}, title: 'x', body: null }).title).toBe('notif.applicationWithdrawn.title')
  })

  it('keeps the note-mention preview body (user content) unlocalized', () => {
    const r = renderNotification(t, { type: 'note_mention', data: { author: 'Ann', candidate: 'Bob' }, title: 'x', body: 'the raw note text' })
    expect(r.title).toBe('notif.noteMention.title|author=Ann,candidate=Bob')
    expect(r.body).toBe('the raw note text')
  })

  it('falls back for an unknown type', () => {
    expect(renderNotification(t, { type: 'mystery', data: {}, title: 'Stored', body: null }).title).toBe('Stored')
  })
})

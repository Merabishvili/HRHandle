import { describe, it, expect } from 'vitest'
import {
  defaultMeetingOption,
  eligibleInterviewers,
  type InterviewTeamMemberOption,
} from '@/components/interviews/interview-form-helpers'

describe('eligibleInterviewers', () => {
  const owner: InterviewTeamMemberOption = { id: 'u1', full_name: 'Owner', email: 'owner@x.com' }
  const other: InterviewTeamMemberOption = { id: 'u2', full_name: 'Other', email: 'other@x.com' }
  const members = [owner, other]

  it('returns everyone when the candidate has no email', () => {
    expect(eligibleInterviewers(members, null, 'u1')).toEqual(members)
    expect(eligibleInterviewers(members, '', 'u1')).toEqual(members)
  })

  it('drops a non-current member who is the candidate (internal applicant)', () => {
    expect(eligibleInterviewers(members, 'OTHER@x.com', 'u1')).toEqual([owner])
  })

  it('never drops the current user even when they share the candidate email (#10)', () => {
    // The candidate shares the owner's email and the owner is the current user —
    // the picker must not end up empty.
    expect(eligibleInterviewers(members, 'owner@x.com', 'u1')).toEqual(members)
  })

  it('keeps a single-member org selectable when that member is the current user', () => {
    expect(eligibleInterviewers([owner], 'owner@x.com', 'u1')).toEqual([owner])
  })
})

describe('defaultMeetingOption', () => {
  it('honours the preferred provider when it is connected', () => {
    expect(defaultMeetingOption(true, true, true, 'zoom')).toBe('zoom')
    expect(defaultMeetingOption(true, true, true, 'teams')).toBe('teams')
    expect(defaultMeetingOption(true, true, true, 'google_meet')).toBe('google_meet')
  })

  it('ignores the preferred provider when it is NOT connected, falling back to order', () => {
    // preferred zoom, but zoom not connected → falls to Google (first connected)
    expect(defaultMeetingOption(true, false, false, 'zoom')).toBe('google_meet')
    // preferred teams, teams not connected, only zoom connected → zoom
    expect(defaultMeetingOption(false, true, false, 'teams')).toBe('zoom')
  })

  it('uses the Google > Zoom > Teams order when no preference is given', () => {
    expect(defaultMeetingOption(true, true, true)).toBe('google_meet')
    expect(defaultMeetingOption(false, true, true)).toBe('zoom')
    expect(defaultMeetingOption(false, false, true)).toBe('teams')
  })

  it('falls back to manual when nothing is connected', () => {
    expect(defaultMeetingOption(false, false, false)).toBe('manual')
    expect(defaultMeetingOption(false, false, false, 'zoom')).toBe('manual')
  })

  it('treats a null preference like no preference', () => {
    expect(defaultMeetingOption(true, false, false, null)).toBe('google_meet')
  })
})

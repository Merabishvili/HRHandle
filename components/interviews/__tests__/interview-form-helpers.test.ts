import { describe, it, expect } from 'vitest'
import { defaultMeetingOption } from '@/components/interviews/interview-form-helpers'

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

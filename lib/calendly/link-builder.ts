/**
 * Compose a Calendly scheduling URL pre-filled with the candidate's info
 * and a UTM tag carrying the HRHandle application ID. When the candidate
 * books, Calendly fires the `invitee.created` webhook with the UTM tag
 * intact, letting us match the booking back to the application row.
 */
export interface CalendlyLinkInput {
  schedulingUrl: string // e.g. https://calendly.com/jane/intro-30min
  applicationId: string
  candidateName?: string | null
  candidateEmail?: string | null
}

export function buildCalendlyLink(input: CalendlyLinkInput): string {
  let url: URL
  try {
    url = new URL(input.schedulingUrl)
  } catch {
    throw new Error('Invalid Calendly URL')
  }

  if (input.candidateName) url.searchParams.set('name', input.candidateName)
  if (input.candidateEmail) url.searchParams.set('email', input.candidateEmail)
  url.searchParams.set('utm_source', 'hrhandle')
  url.searchParams.set('utm_medium', 'recruiter_link')
  url.searchParams.set('utm_content', input.applicationId)

  return url.toString()
}

/** Pull the application_id we tagged onto a Calendly booking webhook. */
export function applicationIdFromTracking(tracking: { utm_content?: string | null } | null | undefined): string | null {
  if (!tracking) return null
  const v = tracking.utm_content
  if (!v) return null
  return /^[0-9a-f-]{30,}$/i.test(v) ? v : null
}

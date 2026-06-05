import posthog from 'posthog-js'

// Named product events. Keep this list as the single source of truth so event
// names stay consistent across the app and dashboards don't fragment on typos.
export type AnalyticsEvent =
  | 'vacancy_created'
  | 'candidate_created'
  | 'candidate_stage_changed'
  | 'interview_scheduled'
  | 'application_submitted'

// Event properties must stay PII-free by convention — ids, counts, enums, and
// booleans only. Never pass names, emails, free-text, or anything that could
// identify a candidate.
type AnalyticsProperties = Record<string, string | number | boolean | null>

/**
 * Capture a named product event. Safe to call anywhere on the client: it no-ops
 * on the server and whenever PostHog hasn't initialized (no key configured).
 */
export function capture(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  if (typeof window === 'undefined') return
  if (!posthog.__loaded) return
  posthog.capture(event, properties)
}

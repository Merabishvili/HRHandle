/**
 * Decide whether to nudge a freshly-onboarded OAuth user to connect the
 * calendar/meeting integration that matches how they signed in.
 *
 * Google sign-in (`provider === 'google'`) → prompt Google Calendar/Meet.
 * Microsoft sign-in (`provider === 'azure'`) → prompt Microsoft Teams/Outlook.
 * Email signups, already-connected users, and users who dismissed the prompt
 * get nothing. See docs/4-integrations/overview or the integrations page — the
 * actual connect flow is the same `/api/auth/{google,microsoft}` OAuth used in
 * Settings → Integrations.
 */
export type IntegrationPromptProvider = 'google' | 'microsoft'

export function resolveIntegrationPrompt(input: {
  /** Supabase `user.app_metadata.provider` — 'google' | 'azure' | 'email' | … */
  provider: string | undefined | null
  hasGoogle: boolean
  hasMicrosoft: boolean
  dismissed: boolean
}): IntegrationPromptProvider | null {
  if (input.dismissed) return null
  if (input.provider === 'google') return input.hasGoogle ? null : 'google'
  if (input.provider === 'azure') return input.hasMicrosoft ? null : 'microsoft'
  return null
}

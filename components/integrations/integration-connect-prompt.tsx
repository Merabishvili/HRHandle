import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveIntegrationPrompt } from '@/lib/integrations/prompt'
import { IntegrationConnectBanner } from './integration-connect-banner'

/**
 * Renders a "connect your calendar" nudge when an OAuth user hasn't linked the
 * integration matching their sign-in provider (Google → Calendar/Meet, Microsoft
 * → Teams/Outlook). Returns null in the common cases without touching the DB:
 * only OAuth users who haven't dismissed the prompt incur the token lookup.
 *
 * `userId` / `provider` come from the layout's already-loaded session, so this
 * adds no extra auth round-trip.
 */
export async function IntegrationConnectPrompt({
  userId,
  provider,
}: {
  userId: string
  provider: string | undefined | null
}) {
  // Cheap gates first — no query for email signups or dismissed prompts.
  if (provider !== 'google' && provider !== 'azure') return null
  const dismissed = (await cookies()).get('int_prompt_dismissed')?.value === '1'
  if (dismissed) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token, microsoft_refresh_token')
    .eq('id', userId)
    .single()

  const target = resolveIntegrationPrompt({
    provider,
    hasGoogle: !!profile?.google_refresh_token,
    hasMicrosoft: !!profile?.microsoft_refresh_token,
    dismissed,
  })
  if (!target) return null

  return <IntegrationConnectBanner provider={target} />
}

'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// Ties events to the logged-in user by Supabase user id only — no email or name
// is sent (consistent with the PII posture in lib/sentry-scrub.ts). Mounted in
// the dashboard layout, so public /apply and /jobs visitors stay anonymous.
export function PostHogIdentify({
  userId,
  orgId,
  role,
}: {
  userId: string
  orgId: string | null
  role: string
}) {
  useEffect(() => {
    if (!posthog.__loaded || !userId) return
    posthog.identify(userId, { org_id: orgId ?? undefined, role })
    if (orgId) posthog.group('organization', orgId)
  }, [userId, orgId, role])

  return null
}

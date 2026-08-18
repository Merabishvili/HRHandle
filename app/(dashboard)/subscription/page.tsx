import { redirect } from 'next/navigation'

/**
 * Legacy /subscription route — Wave 1.2 / S07 §2.8 consolidated billing
 * UI into /settings/billing. This redirect preserves external bookmarks
 * and the layout/middleware references that still point at /subscription.
 *
 * Per locked Q-S7-g, the redirect stays for ~6 months before the route
 * itself is removed.
 */
export default function LegacySubscriptionPage() {
  redirect('/settings/billing')
}

'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { shouldRedirectToBilling } from '@/lib/billing/access'

/**
 * Client half of the locked-org redirect. The dashboard layout redirects a
 * locked org to /settings/billing on a full page load, but shared layouts don't
 * re-render on client navigation — so after landing on billing, any sidebar
 * click rendered its page and the whole app stayed usable. This re-applies the
 * same rule on every navigation and renders nothing for a gated page, so
 * locked content never flashes.
 *
 * `locked` comes from the layout's last server render; a full load (e.g. the
 * Flitt return after paying) refreshes it.
 */
export function SubscriptionLockGate({ locked, children }: { locked: boolean; children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const gated = shouldRedirectToBilling(locked, pathname)

  useEffect(() => {
    if (gated) router.replace('/settings/billing')
  }, [gated, router])

  return gated ? null : <>{children}</>
}

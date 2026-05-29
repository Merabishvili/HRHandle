'use client'

import { Suspense, useEffect, type ReactNode } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'

// Gated on key presence (mirrors Sentry's DSN gating). No key — e.g. local dev
// without it, CI, or staging — means PostHog never initializes and every call
// is a no-op. Host defaults to EU cloud.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!posthogKey || posthog.__loaded) return
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Only create person profiles for identified (logged-in) users. Anonymous
      // visitors on /apply and /jobs stay profile-less — better privacy, less quota.
      person_profiles: 'identified_only',
      // App Router client-side navigations don't fire full page loads, so we
      // capture $pageview manually in PostHogPageView below.
      capture_pageview: false,
    })
  }, [])

  if (!posthogKey) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}

// Fires a $pageview on every App Router navigation. usePathname/useSearchParams
// require a Suspense boundary, which the parent provides.
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (!pathname || !posthog) return
    let url = window.origin + pathname
    const search = searchParams.toString()
    if (search) url += '?' + search
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, posthog])

  return null
}

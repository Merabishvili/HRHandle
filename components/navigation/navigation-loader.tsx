'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * One global route-transition affordance (stale-while-revalidate) per
 * `Loading Stale While Revalidate.dc.html`.
 *
 * On navigation start the CURRENT page stays mounted — it is dimmed
 * (opacity + pointer-events off) rather than blanked/skeletoned — and a single
 * thin indeterminate bar shows under the top nav. When the new route's data
 * resolves the route key changes, the dim lifts and the content crossfades in.
 * There are no per-field / per-section loaders and no green flash (the route
 * `loading.tsx` skeletons were removed so the previous page is kept instead).
 *
 * Navigation start is detected the way the common App-Router progress bars do:
 * capture internal `<a>` clicks and patch `history.pushState` (covers
 * `router.push`) + `popstate` (back/forward). Completion is the `usePathname`
 * / `useSearchParams` change once the new page has rendered.
 */
export function NavigationLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Completion — the new page (path + query) has rendered.
  const routeKey = `${pathname}?${searchParams.toString()}`
  useEffect(() => {
    setNavigating(false)
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
  }, [routeKey])

  useEffect(() => {
    const start = () => {
      setNavigating(true)
      // Fail-safe: never leave the page dimmed if a navigation is aborted.
      if (safetyTimer.current) clearTimeout(safetyTimer.current)
      safetyTimer.current = setTimeout(() => setNavigating(false), 8000)
    }

    const isSameLocation = (url: URL) =>
      url.pathname === window.location.pathname && url.search === window.location.search

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      const target = anchor.getAttribute('target')
      if (!href || href.startsWith('#') || (target && target !== '_self') || anchor.hasAttribute('download'))
        return
      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || isSameLocation(url)) return
      start()
    }

    document.addEventListener('click', onClick, true)

    // Programmatic navigations (router.push) go through history.pushState.
    const originalPushState = window.history.pushState
    window.history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const dest = args[2]
      if (dest != null) {
        try {
          if (!isSameLocation(new URL(String(dest), window.location.href))) start()
        } catch {
          /* ignore malformed URLs */
        }
      }
      return originalPushState.apply(this, args)
    }

    const onPopState = () => start()
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('click', onClick, true)
      window.history.pushState = originalPushState
      window.removeEventListener('popstate', onPopState)
      if (safetyTimer.current) clearTimeout(safetyTimer.current)
    }
  }, [])

  return (
    <>
      {/* The single loading indicator — a thin indeterminate bar under the top
          nav, offset by the sidebar on desktop. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 top-14 z-50 h-0.5 overflow-hidden transition-opacity duration-150 lg:left-64',
          navigating ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="h-full w-1/3 rounded-full bg-primary animate-[nav-loading_1.15s_ease-in-out_infinite] motion-reduce:animate-pulse motion-reduce:w-full" />
      </div>

      {/* Keep the outgoing page visible but dimmed + non-interactive; crossfade
          back to full opacity when the new content resolves. */}
      <div
        className={cn(
          'transition-opacity duration-200 motion-reduce:transition-none',
          navigating && 'pointer-events-none select-none opacity-50',
        )}
      >
        {children}
      </div>
    </>
  )
}

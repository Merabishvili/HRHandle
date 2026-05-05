'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SESSION_REMEMBER_KEY, SESSION_LAST_ACTIVE_KEY } from '@/lib/session'

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000   // 8 hours
const PAGE_CLOSE_GRACE_MS = 30 * 60 * 1000   // 30 minutes
const HEARTBEAT_MS = 60 * 1000               // 60 seconds

export function SessionGuard() {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const rememberMe = localStorage.getItem(SESSION_REMEMBER_KEY)
    if (rememberMe !== 'false') return

    const supabase = createClient()

    const signOutAndRedirect = async () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      await supabase.auth.signOut()
      window.location.replace('/auth/login')
    }

    // Check if the page was closed longer than the grace period
    const lastActiveRaw = localStorage.getItem(SESSION_LAST_ACTIVE_KEY)
    if (lastActiveRaw) {
      const elapsed = Date.now() - parseInt(lastActiveRaw, 10)
      if (elapsed > PAGE_CLOSE_GRACE_MS) {
        signOutAndRedirect()
        return
      }
    }

    // Page is open — stamp now so heartbeat picks up from here
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, Date.now().toString())

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(signOutAndRedirect, IDLE_TIMEOUT_MS)
    }

    resetIdleTimer()

    const handleActivity = () => resetIdleTimer()

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))

    heartbeatRef.current = setInterval(() => {
      localStorage.setItem(SESSION_LAST_ACTIVE_KEY, Date.now().toString())
    }, HEARTBEAT_MS)

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      events.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, [])

  return null
}

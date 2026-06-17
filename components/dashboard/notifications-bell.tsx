'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/actions/notifications'
import { getNotificationPreferences } from '@/lib/actions/notification-preferences'

export function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showBadge, setShowBadge] = useState(true)
  const [autoMarkRead, setAutoMarkRead] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load prefs once on mount — respects Personal → Notifications toggles
  // (Wave 1.2 / Phase 0.7). On failure or pre-Migration-045 profile, the
  // defaults (true/true) stand so the bell never silently disappears.
  useEffect(() => {
    let cancelled = false
    getNotificationPreferences().then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        setShowBadge(result.data.in_product.show_bell_badge)
        setAutoMarkRead(result.data.in_product.auto_mark_read)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch {
      // Ignore — table may not exist yet or network error
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleClick = async (n: Notification) => {
    if (!n.read_at && autoMarkRead) {
      try {
        await markNotificationRead(n.id)
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
        )
      } catch (err) {
        console.error('[notifications-bell] mark-read failed:', err)
        toast.error('Could not mark notification as read.')
      }
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    } catch (err) {
      console.error('[notifications-bell] mark-all-read failed:', err)
      toast.error('Could not mark notifications as read.')
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {showBadge && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-10 z-40 w-80 rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={[
                      'w-full border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50',
                      !n.read_at ? 'bg-primary/5' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2.5">
                      {!n.read_at ? (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <div className="mt-1.5 h-2 w-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

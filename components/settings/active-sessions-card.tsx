'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import {
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  CircleHelp,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { revokeOtherSessions, revokeSession, type ActiveSession } from '@/lib/actions/active-sessions'
import { parseUserAgent, type DeviceKind } from '@/lib/active-sessions/parse-user-agent'

interface Props {
  sessions: ActiveSession[]
  currentSessionId: string | null
}

const ICON_BY_DEVICE: Record<DeviceKind, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: CircleHelp,
}

/**
 * A-8b — Active sessions card on /settings/security.
 *
 * Shows every session for the current user with parsed device/browser
 * labels, last-active relative time, and either "This device" badge or
 * an individual "Sign out" button. A header "Sign out everywhere"
 * button revokes every session except the current one.
 */
export function ActiveSessionsCard({ sessions: initial, currentSessionId }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [sessions, setSessions] = useState(initial)
  const [otherOpen, setOtherOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleRevoke = (id: string) => {
    setPendingId(id)
    startTransition(async () => {
      const result = await revokeSession(id)
      setPendingId(null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
      toast.success(t('sessions.revokedOne'))
    })
  }

  const handleSignOutOthers = () => {
    startTransition(async () => {
      const result = await revokeOtherSessions(currentSessionId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSessions((prev) => prev.filter((s) => s.id === currentSessionId))
      setOtherOpen(false)
      router.refresh()
      const n = result.data.revoked
      toast.success(n === 0 ? t('sessions.noneActive') : t('sessions.revokedN', { count: n }))
    })
  }

  const otherCount = currentSessionId
    ? sessions.filter((s) => s.id !== currentSessionId).length
    : sessions.length

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t('sessions.title')}</CardTitle>
          <CardDescription>{t('sessions.subtitle')}</CardDescription>
        </div>
        {otherCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setOtherOpen(true)}
            disabled={pending}
          >
            {t('sessions.signOutEverywhere')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            {t('sessions.noneToShow')}
          </p>
        )}
        {sessions.map((s) => {
          const parsed = parseUserAgent(s.user_agent)
          const Icon = ICON_BY_DEVICE[parsed.device]
          const isCurrent = s.id === currentSessionId
          const lastSeen = s.refreshed_at ?? s.created_at
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {parsed.os} · {parsed.browser}
                  </p>
                  {isCurrent && (
                    <Badge
                      variant="secondary"
                      className="border-transparent bg-emerald-50 text-emerald-700"
                    >
                      {t('sessions.thisDevice')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.ip ? `${s.ip} · ` : ''}
                  {isCurrent
                    ? t('sessions.activeNow')
                    : t('sessions.lastActive', { time: formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) })}
                </p>
              </div>
              {!isCurrent && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs font-semibold text-destructive hover:text-destructive"
                  onClick={() => handleRevoke(s.id)}
                  disabled={pending}
                >
                  {pending && pendingId === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <LogOut className="h-3 w-3" aria-hidden />
                  )}
                  {t('sessions.signOut')}
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>

      <AlertDialog open={otherOpen} onOpenChange={(v) => !pending && setOtherOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessions.signOutOthersTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sessions.signOutOthersDesc', { count: otherCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSignOutOthers()
              }}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t('sessions.signingOut')}
                </>
              ) : (
                t('sessions.signOutOthers')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

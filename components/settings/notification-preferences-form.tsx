'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { updateNotificationPreferences } from '@/lib/actions/notification-preferences'
import {
  MATRIX_EVENTS,
  type MatrixEventMeta,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

interface Props {
  initial: NotificationPreferences
}

type Channel = 'in_app' | 'email'

/**
 * A-7 Settings → Notifications: per-user event × channel matrix.
 *
 * Rows are events (defined in MATRIX_EVENTS); columns are channels
 * (In-app, Email). The matrix reads from / writes to the flat `email` and
 * `in_app_events` objects on the JSONB column. There's no per-person Slack
 * column: Slack / Teams posts go to a shared channel, so what a channel
 * receives is set per channel (Settings → Integrations → Slack & Teams). The
 * old `slack_events` key stays in the JSON (unused) and is saved back as-is.
 */
export function NotificationPreferencesForm({ initial }: Props) {
  const t = useTranslations()
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [isPending, startTransition] = useTransition()

  const isChannelOn = (event: MatrixEventMeta, channel: Channel): boolean => {
    if (channel === 'in_app') {
      if (event.inAppLocked) return true
      return prefs.in_app_events[event.inAppKey]
    }
    return prefs.email[event.emailKey]
  }

  const setChannel = (event: MatrixEventMeta, channel: Channel, value: boolean) => {
    if (channel === 'in_app' && event.inAppLocked) return
    setPrefs((p) => {
      if (channel === 'in_app') {
        return { ...p, in_app_events: { ...p.in_app_events, [event.inAppKey]: value } }
      }
      return { ...p, email: { ...p.email, [event.emailKey]: value } }
    })
  }

  const onSave = () => {
    startTransition(async () => {
      const result = await updateNotificationPreferences(prefs)
      if (result.success) {
        toast.success(t('notifPrefs.saved'))
      } else {
        toast.error(result.error ?? t('notifPrefs.errSave'))
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border">
        <CardHeader>
          <CardTitle>{t('settings.nav.notifications')}</CardTitle>
          <CardDescription>
            {t('notifPrefs.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-y border-border bg-muted/40 px-5 py-2.5 text-[11.5px] font-semibold text-muted-foreground sm:px-6">
            <span>{t('notifPrefs.eventCol')}</span>
            <span className="text-center">{t('notifPrefs.inApp')}</span>
            <span className="text-center">{t('candWizard.personal.email')}</span>
          </div>

          {/* Event rows */}
          {MATRIX_EVENTS.map((event, idx) => (
            <div
              key={event.key}
              className={cn(
                'grid grid-cols-[1fr_72px_72px] items-center gap-2 px-5 py-3 sm:px-6',
                idx !== MATRIX_EVENTS.length - 1 && 'border-b border-border/60',
              )}
            >
              <div>
                <p className="text-[13px] font-semibold text-foreground">{t(`notifPrefs.event.${event.key}.title`)}</p>
                <p className="text-[11.5px] text-muted-foreground">{t(`notifPrefs.event.${event.key}.description`)}</p>
              </div>
              <MatrixCheckbox
                checked={isChannelOn(event, 'in_app')}
                onChange={(v) => setChannel(event, 'in_app', v)}
                disabled={isPending || event.inAppLocked}
                lockedReason={
                  event.inAppLocked ? t('notifPrefs.mentionsAlwaysOn') : undefined
                }
                ariaLabel={t('notifPrefs.cellAria', { title: t(`notifPrefs.event.${event.key}.title`), channel: t('notifPrefs.inApp') })}
              />
              <MatrixCheckbox
                checked={isChannelOn(event, 'email')}
                onChange={(v) => setChannel(event, 'email', v)}
                disabled={isPending}
                ariaLabel={t('notifPrefs.cellAria', { title: t(`notifPrefs.event.${event.key}.title`), channel: t('candWizard.personal.email') })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.saving')}
            </>
          ) : (
            t('notifPrefs.savePrefs')
          )}
        </Button>
      </div>
    </div>
  )
}

function MatrixCheckbox({
  checked,
  onChange,
  disabled,
  lockedReason,
  ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean | undefined
  lockedReason?: string | undefined
  ariaLabel: string
}) {
  // A locked-on cell (e.g. in-app @mentions) is forced on and can't be toggled;
  // render it in a muted "locked" style with a lock glyph so it reads as
  // locked-on rather than an ordinary togglable checkbox.
  const lockedOn = !!lockedReason && checked
  return (
    <div className="flex justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-readonly={!!lockedReason}
        title={lockedReason}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors',
          lockedOn
            ? 'border-border bg-muted-foreground/70 text-background'
            : checked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background',
          disabled && !checked && 'opacity-40',
          disabled && 'cursor-not-allowed',
          !disabled && 'hover:border-primary/60',
        )}
      >
        {lockedOn ? (
          <Lock className="h-2.5 w-2.5" aria-hidden />
        ) : checked ? (
          <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
        ) : (
          lockedReason && <Lock className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
        )}
      </button>
    </div>
  )
}


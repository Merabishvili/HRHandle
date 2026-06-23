'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { updateNotificationPreferences } from '@/lib/actions/notification-preferences'
import {
  MATRIX_EVENTS,
  type EmailDelivery,
  type MatrixEventMeta,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

interface Props {
  initial: NotificationPreferences
  /** True when the org has at least one active Slack webhook (G-030). */
  slackAvailable: boolean
}

type Channel = 'in_app' | 'email' | 'slack'

/**
 * A-7 Settings → Notifications: per-user event × channel matrix.
 *
 * Rows are events (defined in MATRIX_EVENTS); columns are channels
 * (In-app, Email, Slack). The matrix reads from / writes to the flat
 * `email`, `in_app_events`, and `slack_events` objects on the JSONB
 * column so dispatcher code only ever consults one boolean per
 * (event, channel) pair.
 */
export function NotificationPreferencesForm({ initial, slackAvailable }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [isPending, startTransition] = useTransition()

  const isChannelOn = (event: MatrixEventMeta, channel: Channel): boolean => {
    if (channel === 'in_app') {
      if (event.inAppLocked) return true
      return prefs.in_app_events[event.inAppKey]
    }
    if (channel === 'email') return prefs.email[event.emailKey]
    return prefs.slack_events[event.slackKey]
  }

  const setChannel = (event: MatrixEventMeta, channel: Channel, value: boolean) => {
    if (channel === 'in_app' && event.inAppLocked) return
    if (channel === 'slack' && !slackAvailable) return
    setPrefs((p) => {
      if (channel === 'in_app') {
        return { ...p, in_app_events: { ...p.in_app_events, [event.inAppKey]: value } }
      }
      if (channel === 'email') {
        return { ...p, email: { ...p.email, [event.emailKey]: value } }
      }
      return { ...p, slack_events: { ...p.slack_events, [event.slackKey]: value } }
    })
  }

  const setEmailDelivery = (mode: EmailDelivery) => {
    setPrefs((p) => ({ ...p, email_delivery: mode }))
  }

  const onSave = () => {
    startTransition(async () => {
      const result = await updateNotificationPreferences(prefs)
      if (result.success) {
        toast.success('Preferences saved')
      } else {
        toast.error(result.error ?? 'Could not save preferences')
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Per-user preferences. Choose how you hear about each event.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_72px_72px_72px] items-center gap-2 border-y border-border bg-muted/40 px-5 py-2.5 text-[11.5px] font-semibold text-muted-foreground sm:px-6">
            <span>Event</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
            <span
              className={cn(
                'text-center',
                !slackAvailable && 'text-muted-foreground/50',
              )}
              title={
                slackAvailable
                  ? undefined
                  : 'Connect a Slack webhook in Settings → Integrations to enable this column'
              }
            >
              Slack
            </span>
          </div>

          {/* Event rows */}
          {MATRIX_EVENTS.map((event, idx) => (
            <div
              key={event.key}
              className={cn(
                'grid grid-cols-[1fr_72px_72px_72px] items-center gap-2 px-5 py-3 sm:px-6',
                idx !== MATRIX_EVENTS.length - 1 && 'border-b border-border/60',
              )}
            >
              <div>
                <p className="text-[13px] font-semibold text-foreground">{event.title}</p>
                <p className="text-[11.5px] text-muted-foreground">{event.description}</p>
              </div>
              <MatrixCheckbox
                checked={isChannelOn(event, 'in_app')}
                onChange={(v) => setChannel(event, 'in_app', v)}
                disabled={isPending || event.inAppLocked}
                lockedReason={
                  event.inAppLocked ? 'In-app @mentions are always on' : undefined
                }
                ariaLabel={`${event.title} — In-app`}
              />
              <MatrixCheckbox
                checked={isChannelOn(event, 'email')}
                onChange={(v) => setChannel(event, 'email', v)}
                disabled={isPending}
                ariaLabel={`${event.title} — Email`}
              />
              <MatrixCheckbox
                checked={isChannelOn(event, 'slack')}
                onChange={(v) => setChannel(event, 'slack', v)}
                disabled={isPending || !slackAvailable}
                lockedReason={
                  !slackAvailable
                    ? 'Connect Slack in Settings → Integrations'
                    : undefined
                }
                ariaLabel={`${event.title} — Slack`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Email delivery</CardTitle>
          <CardDescription>
            Slack channel set in Settings → Integrations. In-app notifications always on for @mentions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <DeliveryOption
              label="Instant"
              description="Email as events happen"
              selected={prefs.email_delivery === 'instant'}
              onSelect={() => setEmailDelivery('instant')}
              disabled={isPending}
            />
            <DeliveryOption
              label="Daily digest"
              description="One summary email each morning"
              selected={prefs.email_delivery === 'daily'}
              onSelect={() => setEmailDelivery('daily')}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save preferences'
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
  disabled?: boolean
  lockedReason?: string
  ariaLabel: string
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={ariaLabel}
        title={lockedReason}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background',
          disabled && !checked && 'opacity-40',
          disabled && 'cursor-not-allowed',
          !disabled && 'hover:border-primary/60',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
        {lockedReason && !checked && (
          <Lock className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
        )}
      </button>
    </div>
  )
}

function DeliveryOption({
  label,
  description,
  selected,
  onSelect,
  disabled,
}: {
  label: string
  description: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex flex-1 items-center gap-2.5 rounded-[10px] border px-3.5 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-foreground/20',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'h-4 w-4 shrink-0 rounded-full border',
          selected ? 'border-[4.5px] border-primary' : 'border-1.5 border-border',
        )}
        aria-hidden
      />
      <span>
        <span className={cn('block text-[13px] font-semibold', selected ? 'text-primary' : 'text-foreground')}>
          {label}
        </span>
        <span className="block text-[11.5px] text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

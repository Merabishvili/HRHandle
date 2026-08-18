'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bell, Plus, Trash2, Send, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  DEFAULT_ENABLED_EVENTS,
  type WebhookEvent,
} from '@/lib/notifications/events'
import {
  createWebhook,
  updateWebhookEvents,
  toggleWebhookActive,
  deleteWebhook,
  sendTestWebhookAction,
  type WebhookRow,
} from '@/lib/actions/webhook-notifications'

interface Props {
  initial: WebhookRow[]
}

export function WebhooksManager({ initial }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    router.refresh()
  }

  function showOk(msg: string) {
    setNotice(msg)
    setError(null)
    setTimeout(() => setNotice(null), 4000)
  }

  function showErr(msg: string) {
    setError(msg)
    setNotice(null)
  }

  function onTest(id: string) {
    startTransition(async () => {
      const res = await sendTestWebhookAction(id)
      if (res.success) showOk(t('webhooks.testSent'))
      else showErr(res.error)
    })
  }

  function onToggle(id: string, next: boolean) {
    startTransition(async () => {
      const res = await toggleWebhookActive(id, next)
      if (res.success) refresh()
      else showErr(res.error)
    })
  }

  function onDelete(id: string) {
    if (!confirm(t('webhooks.deleteConfirm'))) return
    startTransition(async () => {
      const res = await deleteWebhook(id)
      if (res.success) {
        showOk(t('webhooks.removed'))
        refresh()
      } else showErr(res.error)
    })
  }

  function onSaveEvents(id: string, events: WebhookEvent[]) {
    startTransition(async () => {
      const res = await updateWebhookEvents(id, events)
      if (res.success) {
        setEditing(null)
        showOk(t('webhooks.eventsUpdated'))
        refresh()
      } else showErr(res.error)
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {initial.length === 0 && !adding && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('webhooks.empty')}</p>
            <Button onClick={() => setAdding(true)} className="gap-2">
              <Plus className="h-4 w-4" /> {t('webhooks.add')}
            </Button>
          </CardContent>
        </Card>
      )}

      {initial.length > 0 && !adding && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('webhooks.add')}
          </Button>
        </div>
      )}

      {initial.map((wh) => (
        <Card key={wh.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{wh.channel_type === 'slack' ? 'Slack' : 'Teams'}</Badge>
                  <span className="font-medium">{wh.name}</span>
                  {!wh.is_active && <Badge variant="secondary">{t('webhooks.disabled')}</Badge>}
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">{wh.webhook_url}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onTest(wh.id)} disabled={isPending} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> {t('webhooks.test')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(wh.id, !wh.is_active)}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <Power className="h-3.5 w-3.5" /> {wh.is_active ? t('common.disable') : t('common.enable')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(wh.id)} disabled={isPending} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> {t('common.delete')}
                </Button>
              </div>
            </div>

            <div className="mt-3 border-t pt-3">
              {editing === wh.id ? (
                <EventEditor
                  initialEvents={wh.enabled_events}
                  onSave={(ev) => onSaveEvents(wh.id, ev)}
                  onCancel={() => setEditing(null)}
                  isPending={isPending}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {wh.enabled_events.length === 0 && (
                      <span className="text-sm text-muted-foreground">{t('webhooks.noEvents')}</span>
                    )}
                    {wh.enabled_events.map((e) => (
                      <Badge key={e} variant="secondary">{WEBHOOK_EVENT_LABELS[e as WebhookEvent] ?? e}</Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(wh.id)}>
                    {t('webhooks.editEvents')}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {adding && (
        <AddWebhookForm
          onCancel={() => {
            setAdding(false)
            setError(null)
          }}
          onSaved={() => {
            setAdding(false)
            showOk(t('webhooks.added'))
            refresh()
          }}
          onError={showErr}
        />
      )}
    </div>
  )
}

function AddWebhookForm({
  onCancel,
  onSaved,
  onError,
}: {
  onCancel: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const t = useTranslations()
  const [channel, setChannel] = useState<'slack' | 'teams'>('slack')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEvent[]>(DEFAULT_ENABLED_EVENTS)
  const [isPending, startTransition] = useTransition()

  function onSubmit() {
    startTransition(async () => {
      const res = await createWebhook({
        channel_type: channel,
        webhook_url: url,
        name,
        enabled_events: events,
      })
      if (res.success) onSaved()
      else onError(res.error)
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>{t('webhooks.channel')}</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as 'slack' | 'teams')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="teams">{t('webhooks.teams')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wh-name">{t('webhooks.nameLabel')}</Label>
          <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wh-url">{t('webhooks.urlLabel')}</Label>
          <Input
            id="wh-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              channel === 'slack'
                ? 'https://hooks.slack.com/services/...'
                : 'https://outlook.office.com/webhook/... or https://...webhook.office.com/...'
            }
          />
          <p className="text-xs text-muted-foreground">
            {channel === 'slack' ? t('webhooks.slackHint') : t('webhooks.teamsHint')}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('webhooks.events')}</Label>
          <EventEditor initialEvents={events} onSave={(ev) => setEvents(ev)} onCancel={() => undefined} inline />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !name.trim() || !url.trim()}>
            {isPending ? t('common.saving') : t('webhooks.saveWebhook')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EventEditor({
  initialEvents,
  onSave,
  onCancel,
  isPending,
  inline,
}: {
  initialEvents: WebhookEvent[]
  onSave: (events: WebhookEvent[]) => void
  onCancel: () => void
  isPending?: boolean
  inline?: boolean
}) {
  const t = useTranslations()
  const [selected, setSelected] = useState<Set<WebhookEvent>>(new Set(initialEvents))

  function toggle(event: WebhookEvent) {
    const next = new Set(selected)
    if (next.has(event)) next.delete(event)
    else next.add(event)
    setSelected(next)
    if (inline) onSave(Array.from(next))
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {WEBHOOK_EVENTS.map((event) => (
          <label key={event} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(event)}
              onChange={() => toggle(event)}
              className="h-4 w-4"
            />
            {WEBHOOK_EVENT_LABELS[event]}
          </label>
        ))}
      </div>
      {!inline && (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={() => onSave(Array.from(selected))} disabled={isPending}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  )
}

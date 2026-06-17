'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { updateNotificationPreferences } from '@/lib/actions/notification-preferences'
import {
  EMAIL_EVENT_LABELS,
  IN_PRODUCT_LABELS,
  type NotificationEmailPreferences,
  type NotificationInProductPreferences,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

interface Props {
  initial: NotificationPreferences
}

export function NotificationPreferencesForm({ initial }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [isPending, startTransition] = useTransition()

  const setEmail = (key: keyof NotificationEmailPreferences, value: boolean) => {
    setPrefs((p) => ({ ...p, email: { ...p.email, [key]: value } }))
  }

  const setInProduct = (key: keyof NotificationInProductPreferences, value: boolean) => {
    setPrefs((p) => ({ ...p, in_product: { ...p.in_product, [key]: value } }))
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

  const emailKeys = Object.keys(EMAIL_EVENT_LABELS) as (keyof NotificationEmailPreferences)[]
  const inProductKeys = Object.keys(IN_PRODUCT_LABELS) as (keyof NotificationInProductPreferences)[]

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Choose which events trigger an email to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {emailKeys.map((key) => {
            const meta = EMAIL_EVENT_LABELS[key]
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{meta.title}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <Switch
                  checked={prefs.email[key]}
                  onCheckedChange={(v) => setEmail(key, v)}
                  disabled={isPending}
                  aria-label={meta.title}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>In-product</CardTitle>
          <CardDescription>How notifications appear inside the app.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {inProductKeys.map((key) => {
            const meta = IN_PRODUCT_LABELS[key]
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{meta.title}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <Switch
                  checked={prefs.in_product[key]}
                  onCheckedChange={(v) => setInProduct(key, v)}
                  disabled={isPending}
                  aria-label={meta.title}
                />
              </div>
            )
          })}
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

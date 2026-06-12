'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { selectCalendlyEventType } from '@/lib/actions/calendly'
import type { CalendlyEventType } from '@/lib/calendly/client'

interface Props {
  selectedUri: string | null
  eventTypes: CalendlyEventType[]
}

export function CalendlyEventTypePicker({ selectedUri, eventTypes }: Props) {
  const router = useRouter()
  const [uri, setUri] = useState(selectedUri ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSave() {
    const found = eventTypes.find((t) => t.uri === uri)
    if (!found) {
      setError('Pick an event type first.')
      return
    }
    startTransition(async () => {
      const res = await selectCalendlyEventType(found.uri, found.name)
      if (res.success) {
        setError(null)
        setNotice('Saved.')
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  if (eventTypes.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No active event types found in your Calendly account. Create one in Calendly, then refresh this page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <Select value={uri} onValueChange={setUri}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an event type" />
        </SelectTrigger>
        <SelectContent>
          {eventTypes.map((t) => (
            <SelectItem key={t.uri} value={t.uri}>
              {t.name} · {t.duration} min
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

      <Button onClick={onSave} disabled={isPending || !uri || uri === (selectedUri ?? '')}>
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

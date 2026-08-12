'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const tr = useTranslations()
  const router = useRouter()
  const [uri, setUri] = useState(selectedUri ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSave() {
    const found = eventTypes.find((et) => et.uri === uri)
    if (!found) {
      setError(tr('calPicker.pickFirst'))
      return
    }
    startTransition(async () => {
      const res = await selectCalendlyEventType(found.uri, found.name)
      if (res.success) {
        setError(null)
        setNotice(tr('calPicker.saved'))
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
          {tr('calPicker.noEventTypes')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <Select value={uri} onValueChange={setUri}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={tr('calPicker.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {eventTypes.map((et) => (
            <SelectItem key={et.uri} value={et.uri}>
              {tr('calPicker.eventOption', { name: et.name, duration: et.duration })}
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
        {isPending ? tr('common.saving') : tr('common.save')}
      </Button>
    </div>
  )
}

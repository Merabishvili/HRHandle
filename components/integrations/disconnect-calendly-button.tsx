'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { disconnectCalendly } from '@/lib/actions/calendly'

export function DisconnectCalendlyButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onClick() {
    if (!confirm('Disconnect Calendly? HRHandle will stop receiving booking events.')) return
    startTransition(async () => {
      await disconnectCalendly()
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={isPending}>
      {isPending ? 'Disconnecting…' : 'Disconnect'}
    </Button>
  )
}

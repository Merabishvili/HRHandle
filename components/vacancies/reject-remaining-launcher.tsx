'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RejectRemainingDialog } from './reject-remaining-dialog'

/**
 * Opens "Reject remaining candidates" on the vacancy page when the address
 * carries `?rejectRemaining=1` (the ⋯ menu, Needs your attention) or
 * `?rejectRemaining=closed` (right after the vacancy was closed). Closing the
 * window removes the parameter again.
 */
export function RejectRemainingLauncher({ vacancyId }: { vacancyId: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const value = params.get('rejectRemaining')

  const close = () => {
    const next = new URLSearchParams(params.toString())
    next.delete('rejectRemaining')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <RejectRemainingDialog
      vacancyId={vacancyId}
      open={!!value}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      afterClose={value === 'closed'}
    />
  )
}

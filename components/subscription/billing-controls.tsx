'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cancelSubscription } from '@/lib/actions/billing'

interface BillingControlsProps {
  /** Owner/admin only — members can't change billing. */
  canManage: boolean
  /** Show the cancel control (paid + active). */
  showCancel: boolean
  /** Auto-renew already stopped (next_billing_at cleared). */
  autoRenewOff: boolean
}

/**
 * Owner/admin cancel-auto-renewal control. The billing-currency override moved
 * into the plan-cards header (next to the monthly/annual toggle), so this now
 * only surfaces when there's a paid subscription to cancel.
 */
export function BillingControls({ canManage, showCancel, autoRenewOff }: BillingControlsProps) {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()
  const [cancelling, setCancelling] = useState(false)

  if (!canManage || !showCancel) return null

  const onCancel = () => {
    setCancelling(true)
    startTransition(async () => {
      const res = await cancelSubscription()
      if (res.success) toast.success(t('billingCtl.cancelled'))
      else toast.error(res.error)
      setCancelling(false)
    })
  }

  return (
    <Card className="border-border">
      <CardContent className="flex flex-wrap items-center justify-end gap-3 px-4 py-3">
        {autoRenewOff ? (
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            {t('billingCtl.autoRenewOff')}
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
            {cancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('billingCtl.cancelSub')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

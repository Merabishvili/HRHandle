'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES, CURRENCY_LABEL, type Currency } from '@/lib/pricing/currency'
import { setBillingCurrency, cancelSubscription } from '@/lib/actions/billing'

interface BillingControlsProps {
  currency: Currency
  /** Owner/admin only — members can't change billing. */
  canManage: boolean
  /** Show the cancel control (paid + active). */
  showCancel: boolean
  /** Auto-renew already stopped (next_billing_at cleared). */
  autoRenewOff: boolean
}

/**
 * Owner/admin billing controls: the manual currency override (GE customers are
 * GEL by law; the selector is for orgs whose billing country differs from
 * detection) and cancel-auto-renewal.
 */
export function BillingControls({
  currency,
  canManage,
  showCancel,
  autoRenewOff,
}: BillingControlsProps) {
  const [pending, startTransition] = useTransition()
  const [cancelling, setCancelling] = useState(false)

  if (!canManage) return null

  const onCurrencyChange = (value: string) => {
    startTransition(async () => {
      const res = await setBillingCurrency(value as Currency)
      if (res.success) toast.success('Billing currency updated.')
      else toast.error(res.error)
    })
  }

  const onCancel = () => {
    setCancelling(true)
    startTransition(async () => {
      const res = await cancelSubscription()
      if (res.success) {
        toast.success('Auto-renewal canceled — you keep access until your period ends.')
      } else {
        toast.error(res.error)
      }
      setCancelling(false)
    })
  }

  return (
    <Card className="border-border">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Billing currency</p>
          <p className="text-xs text-muted-foreground">
            Georgian customers are billed in GEL by law. Change only if your billing country
            differs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={currency} onValueChange={onCurrencyChange} disabled={pending}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCancel &&
            (autoRenewOff ? (
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                Auto-renew off
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
                {cancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                Cancel subscription
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

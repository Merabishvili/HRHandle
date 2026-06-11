'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save, Send } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { createOffer, updateOffer, sendOffer } from '@/lib/actions/offers'
import {
  COMPENSATION_PERIODS,
  COMPENSATION_PERIOD_LABELS,
  type CompensationPeriod,
} from '@/lib/offers/state'

export interface OfferFormInitial {
  id: string | null
  role_title: string
  body: string
  recruiter_message: string | null
  compensation_amount: number | null
  compensation_currency: string | null
  compensation_period: CompensationPeriod | null
  start_date: string | null
  expiry_date: string | null
}

export interface OfferFormProps {
  applicationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: OfferFormInitial
  /** Default role title used when the caller hasn't pre-filled one. */
  fallbackRoleTitle: string
}

const NONE_VALUE = '__none'

export function OfferForm({
  applicationId,
  open,
  onOpenChange,
  initial,
  fallbackRoleTitle,
}: OfferFormProps) {
  const router = useRouter()
  const [roleTitle, setRoleTitle] = useState(initial.role_title || fallbackRoleTitle)
  const [body, setBody] = useState(initial.body)
  const [recruiterMessage, setRecruiterMessage] = useState(initial.recruiter_message ?? '')
  const [compensationAmount, setCompensationAmount] = useState(
    initial.compensation_amount !== null && initial.compensation_amount !== undefined
      ? String(initial.compensation_amount)
      : '',
  )
  const [compensationCurrency, setCompensationCurrency] = useState(
    initial.compensation_currency ?? 'USD',
  )
  const [compensationPeriod, setCompensationPeriod] = useState<CompensationPeriod | typeof NONE_VALUE>(
    initial.compensation_period ?? NONE_VALUE,
  )
  const [startDate, setStartDate] = useState(initial.start_date ?? '')
  const [expiryDate, setExpiryDate] = useState(initial.expiry_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEdit = initial.id !== null

  const buildInput = () => {
    const amount = compensationAmount.trim()
    return {
      role_title: roleTitle.trim(),
      body: body.trim(),
      recruiter_message: recruiterMessage.trim() ? recruiterMessage.trim() : null,
      compensation_amount: amount ? Number(amount) : null,
      compensation_currency: compensationCurrency.trim()
        ? compensationCurrency.trim().toUpperCase()
        : null,
      compensation_period:
        compensationPeriod === NONE_VALUE ? null : (compensationPeriod as CompensationPeriod),
      start_date: startDate ? startDate : null,
      expiry_date: expiryDate ? expiryDate : null,
    }
  }

  const saveDraft = (then?: 'send') =>
    startTransition(async () => {
      setError(null)
      const input = buildInput()
      const result = isEdit
        ? await updateOffer(initial.id as string, input)
        : await createOffer(applicationId, input)
      if (!result.success) {
        setError(result.error)
        return
      }

      if (then !== 'send') {
        toast.success('Offer saved as draft.')
        onOpenChange(false)
        router.refresh()
        return
      }

      // Resolve the id we'll send. createOffer returns `data.id`; updateOffer
      // returns void, so for the edit path we already have initial.id.
      const offerId =
        isEdit
          ? (initial.id as string)
          : (result.success ? (result as { success: true; data: { id: string } }).data.id : '')
      if (!offerId) return

      const sendResult = await sendOffer(offerId)
      if (!sendResult.success) {
        setError(sendResult.error)
        return
      }
      toast.success('Offer sent to candidate.')
      onOpenChange(false)
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit offer draft' : 'Create offer'}</DialogTitle>
          <DialogDescription>
            Fill in what matters for this offer. Compensation, dates, and currency are
            optional — leave them blank if they don&apos;t apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="of-role">Role title</Label>
            <Input
              id="of-role"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              maxLength={200}
              disabled={isPending}
              placeholder="e.g. Senior Backend Engineer"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="of-amount">Compensation</Label>
              <Input
                id="of-amount"
                value={compensationAmount}
                onChange={(e) => setCompensationAmount(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 95000"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-currency">Currency</Label>
              <Input
                id="of-currency"
                value={compensationCurrency}
                onChange={(e) => setCompensationCurrency(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="USD"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-period">Period</Label>
              <Select
                value={compensationPeriod}
                onValueChange={(v) =>
                  setCompensationPeriod(v as CompensationPeriod | typeof NONE_VALUE)
                }
                disabled={isPending}
              >
                <SelectTrigger id="of-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                  {COMPENSATION_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)} ({COMPENSATION_PERIOD_LABELS[p] || '—'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="of-start">Start date</Label>
              <Input
                id="of-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-expiry">Respond-by date</Label>
              <Input
                id="of-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-body">Offer details</Label>
            <Textarea
              id="of-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={20000}
              placeholder="Cover everything the candidate needs to know: benefits, equity, signing bonus, vacation, remote/hybrid, on-call, reporting line, anything else. Line breaks are preserved."
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Plain text — line breaks are preserved. Markdown is not rendered.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-message">Personal note (optional)</Label>
            <Textarea
              id="of-message"
              value={recruiterMessage}
              onChange={(e) => setRecruiterMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="A short personal message from you to the candidate — appears in its own section on their offer page."
              disabled={isPending}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => saveDraft()} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button type="button" onClick={() => saveDraft('send')} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Save &amp; send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

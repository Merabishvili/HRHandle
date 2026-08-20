'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { DatePicker } from '@/components/ui/date-picker'
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
  const t = useTranslations()
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
        toast.success(t('stageBlock.offerSavedDraft'))
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
      toast.success(t('stageBlock.offerSent'))
      onOpenChange(false)
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('offer.editDraft') : t('stageBlock.createOffer')}</DialogTitle>
          <DialogDescription>
            {t('offer.formDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="of-role">{t('offer.roleTitle')}</Label>
            <Input
              id="of-role"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              maxLength={200}
              disabled={isPending}
              placeholder={t('offer.roleTitlePlaceholder')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="of-amount">{t('stageBlock.compensation')}</Label>
              <Input
                id="of-amount"
                value={compensationAmount}
                onChange={(e) => setCompensationAmount(e.target.value)}
                inputMode="decimal"
                placeholder={t('stageBlock.compensationPlaceholder')}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-currency">{t('stageBlock.currency')}</Label>
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
              <Label htmlFor="of-period">{t('offer.period')}</Label>
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
                  <SelectItem value={NONE_VALUE}>{t('candWizard.application.notSpecified')}</SelectItem>
                  {COMPENSATION_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`offer.periodOption.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="of-start">{t('stageBlock.startDate')}</Label>
              <DatePicker
                value={startDate || null}
                onChange={(v) => setStartDate(v ?? '')}
                placeholder={t('common.dateFormat')}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-expiry">{t('stageBlock.respondByDate')}</Label>
              <DatePicker
                value={expiryDate || null}
                onChange={(v) => setExpiryDate(v ?? '')}
                placeholder={t('common.dateFormat')}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-body">{t('stageBlock.offerDetails')}</Label>
            <Textarea
              id="of-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={20000}
              placeholder={t('offer.bodyPlaceholder')}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t('offer.plainTextHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-message">{t('offer.personalNote')}</Label>
            <Textarea
              id="of-message"
              value={recruiterMessage}
              onChange={(e) => setRecruiterMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('offer.notePlaceholder')}
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
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="outline" onClick={() => saveDraft()} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t('stageBlock.saveDraft')}
          </Button>
          <Button type="button" onClick={() => saveDraft('send')} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t('stageBlock.saveSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

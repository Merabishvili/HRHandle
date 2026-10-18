'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  getRemainingRejection,
  rejectRemainingCandidates,
  type RemainingRejectionData,
} from '@/lib/actions/applications'
import { countByStage } from '@/lib/applications/remaining'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import { rejectionReasonLabel } from '@/lib/rejection-i18n'

const NO_TEMPLATE = '__none__'

export interface RejectRemainingDialogProps {
  vacancyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opened right after the vacancy was closed — the wording says so. */
  afterClose?: boolean
}

/**
 * "Reject remaining candidates" for one vacancy — offered when it's closed and
 * from its ⋯ menu (owners/admins). Everyone still in progress (Applied, review
 * and interview stages) is ticked; Offer-stage candidates are listed but never
 * included; hired, rejected and withdrawn ones are never touched. The reason,
 * email switch (off by default) and template work as in the single rejection.
 */
export function RejectRemainingDialog({ vacancyId, open, onOpenChange, afterClose = false }: RejectRemainingDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<RemainingRejectionData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [reasonId, setReasonId] = useState('')
  const [templateId, setTemplateId] = useState(NO_TEMPLATE)
  const [sendEmail, setSendEmail] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setData(null)
    setLoadError(false)
    setExcluded(new Set())
    setSendEmail(false)
    getRemainingRejection(vacancyId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setLoadError(true)
        return
      }
      setData(result.data)
      const firstReason = result.data.reasons[0]?.id ?? ''
      setReasonId(firstReason)
      const linked = result.data.templates.find((tpl) => tpl.reason_id === firstReason)
      setTemplateId(linked?.id ?? result.data.templates[0]?.id ?? NO_TEMPLATE)
    })
    return () => {
      cancelled = true
    }
  }, [open, vacancyId])

  // Picking a reason picks the template linked to it, as in the single rejection.
  useEffect(() => {
    if (!data || !reasonId) return
    const linked = data.templates.find((tpl) => tpl.reason_id === reasonId)
    if (linked) setTemplateId(linked.id)
  }, [reasonId, data])

  const selected = useMemo(
    () => (data?.toReject ?? []).filter((c) => !excluded.has(c.applicationId)),
    [data, excluded],
  )
  const withoutEmail = selected.filter((c) => !c.hasEmail).length
  const selectedTemplate = data?.templates.find((tpl) => tpl.id === templateId) ?? null
  const stageText = (name: string) => (name ? pipelineStageLabel(t, name) : t('reports.stage.applied'))

  const toggle = (applicationId: string, checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (checked) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })

  const handleConfirm = () => {
    if (!data || selected.length === 0) return
    startTransition(async () => {
      const result = await rejectRemainingCandidates({
        vacancyId,
        applicationIds: selected.map((c) => c.applicationId),
        rejectionReasonId: reasonId || null,
        templateId: sendEmail && templateId !== NO_TEMPLATE ? templateId : null,
        sendEmail,
      })
      if (!result.success) {
        toast.error(t('rejectRemaining.failed'))
        return
      }
      const r = result.data
      const parts = [t('rejectRemaining.doneRejected', { count: r.rejected })]
      if (sendEmail) parts.push(t('rejectRemaining.doneEmails', { count: r.emailsSent }))
      if (r.interviewsCancelled > 0) parts.push(t('rejectRemaining.doneInterviews', { count: r.interviewsCancelled }))
      toast.success(parts.join(' · '))
      if (r.emailsFailed > 0) toast.warning(t('rejectRemaining.emailsFailed', { count: r.emailsFailed }))
      if (r.failed > 0) toast.warning(t('rejectRemaining.someFailed', { count: r.failed }))
      if (r.skipped > 0) toast.info(t('rejectRemaining.skipped', { count: r.skipped }))
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(afterClose ? 'rejectRemaining.titleAfterClose' : 'rejectRemaining.title')}</DialogTitle>
          <DialogDescription>
            {data
              ? data.toReject.length > 0
                ? t('rejectRemaining.intro', { count: data.toReject.length, title: data.vacancyTitle })
                : t('rejectRemaining.none')
              : loadError
                ? t('rejectRemaining.loadFailed')
                : t('rejectRemaining.loading')}
          </DialogDescription>
        </DialogHeader>

        {!data && !loadError && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}

        {data && data.toReject.length > 0 && (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label>{t('rejectRemaining.candidates')}</Label>
                <span className="text-xs text-muted-foreground">
                  {countByStage(selected)
                    .map((s) => `${stageText(s.stageName)} ${s.count}`)
                    .join(' · ')}
                </span>
              </div>
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {data.toReject.map((c) => {
                  const id = `rr-${c.applicationId}`
                  return (
                    <li key={c.applicationId} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={id}
                        checked={!excluded.has(c.applicationId)}
                        onCheckedChange={(v) => toggle(c.applicationId, v === true)}
                        disabled={isPending}
                      />
                      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-sm">
                        <span className="truncate text-foreground">{c.candidateName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{stageText(c.stageName)}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-muted-foreground">{t('rejectRemaining.untickHint')}</p>
            </div>

            <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{t('rejectRemaining.notIncluded')}</p>
              {data.atOffer.length > 0 && (
                <p>
                  {t('rejectRemaining.atOffer', {
                    count: data.atOffer.length,
                    names: data.atOffer.map((c) => c.candidateName).join(', '),
                  })}
                </p>
              )}
              <p>{t('rejectRemaining.finalNote')}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('rejectDialog.reason')}</Label>
              {data.reasons.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('rejectDialog.noReasons')}</p>
              ) : (
                <SearchableSelect
                  value={reasonId}
                  onValueChange={setReasonId}
                  disabled={isPending}
                  placeholder={t('rejectDialog.selectReason')}
                  searchPlaceholder={t('rejectDialog.searchReasons')}
                  emptyText={t('rejectDialog.noReasonsMatch')}
                  options={data.reasons.map((r) => ({
                    value: r.id,
                    label: rejectionReasonLabel(t, r.name),
                    searchText: rejectionReasonLabel(t, r.name),
                  }))}
                />
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="rr-send-email" className="cursor-pointer font-medium">
                {t('batchReject.sendEmailEach')}
              </Label>
              <Switch id="rr-send-email" checked={sendEmail} onCheckedChange={setSendEmail} disabled={isPending} />
            </div>

            {sendEmail && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('rejectDialog.emailTemplate')}</Label>
                  {data.templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('rejectDialog.noTemplates')}</p>
                  ) : (
                    <SearchableSelect
                      value={templateId}
                      onValueChange={setTemplateId}
                      disabled={isPending}
                      placeholder={t('rejectDialog.selectTemplate')}
                      searchPlaceholder={t('rejectDialog.searchTemplates')}
                      emptyText={t('rejectDialog.noTemplatesMatch')}
                      options={[
                        { value: NO_TEMPLATE, label: t('rejectDialog.noTemplateOption') },
                        ...data.templates.map((tpl) => {
                          const name = rejectionReasonLabel(t, tpl.name)
                          return {
                            value: tpl.id,
                            label: tpl.reason_id === reasonId && reasonId ? `${name} ✓` : name,
                            searchText: `${name} ${tpl.subject}`,
                          }
                        }),
                      ]}
                    />
                  )}
                </div>
                {selectedTemplate && (
                  <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{t('emailTpl.subjectPrefix')}</span>{' '}
                      {selectedTemplate.subject}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">{t('rejectTpl.bodyPrefix')}</span>{' '}
                      {selectedTemplate.body}
                    </p>
                  </div>
                )}
                {withoutEmail > 0 && (
                  <p className="text-xs text-muted-foreground">{t('rejectRemaining.noEmail', { count: withoutEmail })}</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t(afterClose ? 'rejectRemaining.notNow' : 'common.cancel')}
          </Button>
          {data && data.toReject.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending || selected.length === 0 || !data.rejectedStatusId}
            >
              {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {t('batchReject.confirm', { count: selected.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

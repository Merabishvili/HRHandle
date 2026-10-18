'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Search, X } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import {
  applicationsToReject,
  defaultStageKeys,
  remainingTotal,
  type RemainingCandidate,
} from '@/lib/applications/remaining'
import { fillPreview } from '@/lib/email-preview'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import { rejectionReasonLabel } from '@/lib/rejection-i18n'
import { cn } from '@/lib/utils'

const NO_TEMPLATE = '__none__'
const MAX_MATCHES = 8

export interface RejectRemainingDialogProps {
  vacancyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Reject remaining candidates" for one vacancy (owners/admins) — after closing
 * or archiving it, from its ⋯ menu, or from Needs your attention. Stages are
 * the checkboxes (Offer starts unticked); single candidates are kept back as
 * exceptions through search, so 100 or 1,000 candidates look the same. Hired,
 * rejected and withdrawn candidates never appear. Reason, email switch (off by
 * default) and template work as in the single rejection.
 */
export function RejectRemainingDialog({ vacancyId, open, onOpenChange }: RejectRemainingDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<RemainingRejectionData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [exceptions, setExceptions] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [templateId, setTemplateId] = useState(NO_TEMPLATE)
  const [sendEmail, setSendEmail] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setData(null)
    setLoadError(false)
    setExceptions([])
    setQuery('')
    setSendEmail(false)
    setShowPreview(false)
    getRemainingRejection(vacancyId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setLoadError(true)
        return
      }
      setData(result.data)
      setChecked(new Set(defaultStageKeys(result.data.stages)))
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

  const stages = useMemo(() => data?.stages ?? [], [data])
  const stageName = (name: string) => (name ? pipelineStageLabel(t, name) : t('reports.stage.applied'))
  const candidateById = useMemo(() => {
    const map = new Map<string, { candidate: RemainingCandidate; stage: string; stageKey: string }>()
    for (const s of stages) for (const c of s.candidates) map.set(c.applicationId, { candidate: c, stage: s.name, stageKey: s.key })
    return map
  }, [stages])

  const toReject = useMemo(() => applicationsToReject(stages, checked, exceptions), [stages, checked, exceptions])
  const withoutEmail = toReject.filter((id) => !candidateById.get(id)?.candidate.hasEmail).length

  // Search: candidates of the ticked stages who aren't exceptions yet.
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return []
    const taken = new Set(exceptions)
    return stages
      .filter((s) => checked.has(s.key))
      .flatMap((s) => s.candidates.map((c) => ({ c, stage: s.name })))
      .filter(({ c }) => !taken.has(c.applicationId) && c.candidateName.toLocaleLowerCase().includes(q))
      .slice(0, MAX_MATCHES)
  }, [query, stages, checked, exceptions])

  const addException = (applicationId: string) => {
    setExceptions((prev) => (prev.includes(applicationId) ? prev : [...prev, applicationId]))
    setQuery('')
  }

  const toggleStage = (key: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const template =
    templateId === NO_TEMPLATE ? data?.defaultTemplate ?? null : data?.templates.find((tpl) => tpl.id === templateId) ?? null
  const firstName = toReject.length ? candidateById.get(toReject[0]!)?.candidate.candidateName : undefined
  const samples = data
    ? {
        '{{candidate_name}}': firstName || t('emailTpl.sample.candidateName'),
        '{{role}}': data.vacancyTitle,
        '{{company}}': data.companyName,
        '{{sender_name}}': data.senderName,
        '{{sender_email}}': data.senderEmail,
      }
    : {}

  const handleConfirm = () => {
    if (!data || toReject.length === 0) return
    startTransition(async () => {
      const result = await rejectRemainingCandidates({
        vacancyId,
        stageKeys: [...checked],
        excludedApplicationIds: exceptions,
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
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">{t('rejectRemaining.title')}</DialogTitle>
          <DialogDescription>
            {data
              ? t('rejectRemaining.subtitle', { title: data.vacancyTitle, count: remainingTotal(stages) })
              : loadError
                ? t('rejectRemaining.loadFailed')
                : t('rejectRemaining.loading')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
          {!data && !loadError && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}

          {data && stages.length === 0 && <p className="text-sm text-muted-foreground">{t('rejectRemaining.none')}</p>}

          {data && stages.length > 0 && (
            <>
              {/* Stages — the checkboxes. */}
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border" aria-label={t('rejectRemaining.stagesLabel')}>
                {stages.map((s) => {
                  const on = checked.has(s.key)
                  const excludedHere = exceptions.filter((id) => candidateById.get(id)?.stageKey === s.key).length
                  const id = `rr-stage-${s.key}`
                  return (
                    <li key={s.key} className={cn('flex items-center gap-3 px-4 py-3', s.isOffer && !on && 'bg-muted/40')}>
                      <Checkbox id={id} checked={on} onCheckedChange={(v) => toggleStage(s.key, v === true)} disabled={isPending} />
                      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-foreground">{stageName(s.name)}</span>
                        {s.isOffer && !on && (
                          <span className="shrink-0 rounded-md bg-[oklch(0.95_0.03_70)] px-2 py-0.5 text-xs text-[oklch(0.45_0.08_60)]">
                            {t('rejectRemaining.notByDefault')}
                          </span>
                        )}
                        {on && excludedHere > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t('rejectRemaining.exceptionsCount', { count: excludedHere })}
                          </span>
                        )}
                        <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-foreground">
                          {on ? s.candidates.length - excludedHere : s.candidates.length}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>

              {/* Exceptions — kept back by name. */}
              <div className="space-y-1.5">
                <Label htmlFor="rr-search">{t('rejectRemaining.exceptionsLabel')}</Label>
                <div className="relative">
                  <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-border px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
                    {exceptions.map((applicationId) => {
                      const entry = candidateById.get(applicationId)
                      if (!entry) return null
                      return (
                        <span key={applicationId} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-foreground">
                          <span className="truncate">
                            {entry.candidate.candidateName} · {stageName(entry.stage)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExceptions((prev) => prev.filter((x) => x !== applicationId))}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                            aria-label={t('rejectRemaining.removeException', { name: entry.candidate.candidateName })}
                            disabled={isPending}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      )
                    })}
                    <span className="flex min-w-[10rem] flex-1 items-center gap-1.5 px-1">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <input
                        id="rr-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && matches[0]) {
                            e.preventDefault()
                            addException(matches[0].c.applicationId)
                          } else if (e.key === 'Escape' && query) {
                            e.stopPropagation()
                            setQuery('')
                          }
                        }}
                        placeholder={t('rejectRemaining.searchPlaceholder')}
                        className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        autoComplete="off"
                        disabled={isPending}
                        role="combobox"
                        aria-expanded={!!query.trim()}
                        aria-controls="rr-matches"
                      />
                    </span>
                  </div>
                  {query.trim() && (
                    <ul
                      id="rr-matches"
                      role="listbox"
                      className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md"
                    >
                      {matches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">{t('rejectRemaining.noMatches')}</li>
                      ) : (
                        matches.map(({ c, stage }) => (
                          <li key={c.applicationId} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => addException(c.applicationId)}
                              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              <span className="truncate">{c.candidateName}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{stageName(stage)}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t('rejectRemaining.exceptionsHint')}</p>
              </div>

              {/* Reason and email template. */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-1.5">
                  <Label>{t('rejectDialog.emailTemplate')}</Label>
                  <SearchableSelect
                    value={templateId}
                    onValueChange={setTemplateId}
                    disabled={isPending || !sendEmail}
                    placeholder={t('rejectDialog.selectTemplate')}
                    searchPlaceholder={t('rejectDialog.searchTemplates')}
                    emptyText={t('rejectDialog.noTemplatesMatch')}
                    options={[
                      { value: NO_TEMPLATE, label: t('rejectDialog.noTemplateOption') },
                      ...data.templates.map((tpl) => {
                        const name = rejectionReasonLabel(t, tpl.name)
                        return { value: tpl.id, label: name, searchText: `${name} ${tpl.subject}` }
                      }),
                    ]}
                  />
                </div>
              </div>

              {/* Email switch and preview. */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch id="rr-send-email" checked={sendEmail} onCheckedChange={setSendEmail} disabled={isPending} />
                    <Label htmlFor="rr-send-email" className="cursor-pointer font-medium">
                      {t('rejectDialog.sendEmail')}
                    </Label>
                  </div>
                  {sendEmail && template && (
                    <button
                      type="button"
                      onClick={() => setShowPreview((v) => !v)}
                      className="text-sm font-medium text-[oklch(0.55_0.18_250)] hover:underline"
                    >
                      {t(showPreview ? 'rejectRemaining.hidePreview' : 'rejectRemaining.previewEmail')}
                    </button>
                  )}
                </div>
                {sendEmail && showPreview && template && (
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p>
                      <span className="font-medium text-foreground">{t('emailTpl.subjectPrefix')}</span>{' '}
                      <span className="text-muted-foreground">{fillPreview(template.subject, samples)}</span>
                    </p>
                    <p className="whitespace-pre-line text-muted-foreground">{fillPreview(template.body, samples)}</p>
                  </div>
                )}
                {sendEmail && withoutEmail > 0 && (
                  <p className="text-xs text-muted-foreground">{t('rejectRemaining.noEmail', { count: withoutEmail })}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t('rejectRemaining.footerNote')}</p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            {data && stages.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isPending || toReject.length === 0 || !data.rejectedStatusId}
              >
                {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {t('batchReject.confirm', { count: toReject.length })}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

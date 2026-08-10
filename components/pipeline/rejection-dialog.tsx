'use client'

import { useState, useTransition, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2 } from 'lucide-react'
import { rejectApplication } from '@/lib/actions/applications'

export interface RejectionReason {
  id: string
  name: string
}

export interface RejectionTemplate {
  id: string
  name: string
  subject: string
  body: string
  reason_id: string | null
}

interface Props {
  open: boolean
  applicationId: string
  statusId: string
  /** Wave 2.6 Slice 2b — per-vacancy `pipeline_stages.id` the recruiter
   * dropped onto (e.g. a custom "Closed - not a fit"). Threaded into
   * `rejectApplication.targetPipelineStageId` so the application lands
   * on that specific stage instead of the bucket-mapped default. Omit
   * (or pass null) on legacy callers. */
  targetPipelineStageId?: string | null
  candidateName: string
  reasons: RejectionReason[]
  templates: RejectionTemplate[]
  onSuccess: () => void
  onCancel: () => void
}

const NO_TEMPLATE = '__none__'

export function RejectionDialog({
  open,
  applicationId,
  statusId,
  targetPipelineStageId,
  candidateName,
  reasons,
  templates,
  onSuccess,
  onCancel,
}: Props) {
  const tr = useTranslations()
  const [reasonId, setReasonId] = useState<string>(reasons[0]?.id ?? '')
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE)
  const [sendEmail, setSendEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // When reason changes, auto-select the template linked to that reason
  useEffect(() => {
    const linked = templates.find((t) => t.reason_id === reasonId)
    setTemplateId(linked?.id ?? (templates[0]?.id ?? NO_TEMPLATE))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasonId])

  // On open, initialise with first reason's linked template
  useEffect(() => {
    if (open) {
      const firstReason = reasons[0]
      setReasonId(firstReason?.id ?? '')
      const linked = templates.find((t) => t.reason_id === firstReason?.id)
      setTemplateId(linked?.id ?? (templates[0]?.id ?? NO_TEMPLATE))
      setSendEmail(false)
      setError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedTemplate = templateId !== NO_TEMPLATE
    ? templates.find((t) => t.id === templateId) ?? null
    : null

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await rejectApplication({
        applicationId,
        statusId,
        rejectionReasonId: reasonId || null,
        templateId: sendEmail && templateId !== NO_TEMPLATE ? templateId : null,
        sendEmail,
        targetPipelineStageId: targetPipelineStageId ?? null,
      })
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('rejectDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {tr.rich('rejectDialog.rejecting', { name: candidateName, b: (c) => <strong className="text-foreground">{c}</strong> })}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Reason selector */}
          <div className="space-y-1.5">
            <Label>{tr('rejectDialog.reason')}</Label>
            {reasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {tr('rejectDialog.noReasons')}
              </p>
            ) : (
              <SearchableSelect
                value={reasonId}
                onValueChange={setReasonId}
                disabled={isPending}
                placeholder={tr('rejectDialog.selectReason')}
                searchPlaceholder={tr('rejectDialog.searchReasons')}
                emptyText={tr('rejectDialog.noReasonsMatch')}
                options={reasons.map((r) => ({
                  value: r.id,
                  label: r.name,
                  searchText: r.name,
                }))}
              />
            )}
          </div>

          {/* Send email toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="send-email-toggle" className="cursor-pointer font-medium">{tr('rejectDialog.sendEmail')}</Label>
            <Switch
              id="send-email-toggle"
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              disabled={isPending}
            />
          </div>

          {/* Template selector — shown when send email is on */}
          {sendEmail && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{tr('rejectDialog.emailTemplate')}</Label>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tr('rejectDialog.noTemplates')}
                  </p>
                ) : (
                  <SearchableSelect
                    value={templateId}
                    onValueChange={setTemplateId}
                    disabled={isPending}
                    placeholder={tr('rejectDialog.selectTemplate')}
                    searchPlaceholder={tr('rejectDialog.searchTemplates')}
                    emptyText={tr('rejectDialog.noTemplatesMatch')}
                    options={[
                      { value: NO_TEMPLATE, label: tr('rejectDialog.noTemplateOption') },
                      ...templates.map((t) => ({
                        value: t.id,
                        label: t.reason_id === reasonId && reasonId ? `${t.name} ✓` : t.name,
                        searchText: `${t.name} ${t.subject}`,
                      })),
                    ]}
                  />
                )}
              </div>

              {/* Template preview */}
              {selectedTemplate && (
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">{tr('emailTpl.subjectPrefix')}</span>{' '}
                    {selectedTemplate.subject}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">{tr('rejectTpl.bodyPrefix')}</span>{' '}
                    {selectedTemplate.body}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>{tr('common.cancel')}</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {tr('rejectDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

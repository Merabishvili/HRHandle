'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { rejectApplication } from '@/lib/actions/applications'
import { DEFAULT_REJECTION_SUBJECT, DEFAULT_REJECTION_BODY } from '@/lib/email-template-utils'

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
  candidateName: string
  reasons: RejectionReason[]
  templates: RejectionTemplate[]
  onSuccess: () => void
  onCancel: () => void
}

export function RejectionDialog({
  open,
  applicationId,
  statusId,
  candidateName,
  reasons,
  templates,
  onSuccess,
  onCancel,
}: Props) {
  const [reasonId, setReasonId] = useState<string>(reasons[0]?.id ?? '')
  const [templateId, setTemplateId] = useState<string>('')
  const [sendEmail, setSendEmail] = useState(false)
  const [customSubject, setCustomSubject] = useState(DEFAULT_REJECTION_SUBJECT)
  const [customBody, setCustomBody] = useState(DEFAULT_REJECTION_BODY)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const templatesForReason = reasonId
    ? templates.filter((t) => t.reason_id === reasonId)
    : []

  // When reason changes, auto-select template and fill subject/body
  useEffect(() => {
    if (templatesForReason.length >= 1) {
      const first = templatesForReason[0]
      setTemplateId(first.id)
      setCustomSubject(first.subject)
      setCustomBody(first.body)
    } else {
      setTemplateId('')
      setCustomSubject(DEFAULT_REJECTION_SUBJECT)
      setCustomBody(DEFAULT_REJECTION_BODY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasonId])

  // When template selection changes (multiple templates), update subject/body
  const handleTemplateChange = (id: string) => {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) {
      setCustomSubject(t.subject)
      setCustomBody(t.body)
    }
  }

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await rejectApplication({
        applicationId,
        statusId,
        rejectionReasonId: reasonId || null,
        templateId: templateId || null,
        sendEmail,
        customSubject: sendEmail ? customSubject : null,
        customBody: sendEmail ? customBody : null,
      })
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  const hasNoReasons = reasons.length === 0

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onCancel() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject Candidate</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            You are rejecting <strong className="text-foreground">{candidateName}</strong>.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Reason selector */}
          <div className="space-y-1.5">
            <Label>Rejection reason</Label>
            {hasNoReasons ? (
              <p className="text-xs text-muted-foreground">
                No rejection reasons configured. You can still reject — add reasons in Settings → Rejection Reasons.
              </p>
            ) : (
              <Select value={reasonId} onValueChange={setReasonId} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Template selector — only shown if multiple templates for this reason */}
          {templatesForReason.length > 1 && (
            <div className="space-y-1.5">
              <Label>Email template</Label>
              <Select value={templateId} onValueChange={handleTemplateChange} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templatesForReason.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Send email toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="send-email-toggle" className="cursor-pointer font-medium">Send rejection email</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {templateId
                  ? 'Template pre-filled — you can edit it below'
                  : 'Default email template will be used'}
              </p>
            </div>
            <Switch
              id="send-email-toggle"
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              disabled={isPending}
            />
          </div>

          {/* Editable email content */}
          {sendEmail && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  disabled={isPending}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message body</Label>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  disabled={isPending}
                  rows={4}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

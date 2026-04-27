'use client'

import { useState, useTransition, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const templatesForReason = templates.filter((t) => t.reason_id === reasonId)

  // Auto-select first template when reason changes
  useEffect(() => {
    if (templatesForReason.length === 1) {
      setTemplateId(templatesForReason[0].id)
    } else if (templatesForReason.length === 0) {
      setTemplateId('')
    }
    // if multiple, keep current selection if still valid, else reset
    else if (!templatesForReason.find((t) => t.id === templateId)) {
      setTemplateId(templatesForReason[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasonId])

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null

  const handleConfirm = () => {
    if (!reasonId) { setError('Please select a rejection reason.'); return }
    setError(null)
    startTransition(async () => {
      const result = await rejectApplication({
        applicationId,
        statusId,
        rejectionReasonId: reasonId,
        templateId: templateId || null,
        sendEmail: sendEmail && !!templateId,
      })
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onCancel() }}>
      <DialogContent className="sm:max-w-md">
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
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rejection reasons configured. Add them in Settings → Rejection Reasons.
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

          {/* Template selector — only shown if templates exist for this reason */}
          {templatesForReason.length > 0 && (
            <div className="space-y-1.5">
              <Label>Email template</Label>
              {templatesForReason.length === 1 ? (
                <p className="text-sm text-foreground font-medium">{templatesForReason[0].name}</p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId} disabled={isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesForReason.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedTemplate && (
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Subject:</span> {selectedTemplate.subject}</p>
                  <p><span className="font-medium text-foreground">Body:</span> {selectedTemplate.body}</p>
                </div>
              )}

              {/* Send email toggle */}
              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="send-email-toggle" className="cursor-pointer">Send rejection email</Label>
                <Switch
                  id="send-email-toggle"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  disabled={isPending || !templateId}
                />
              </div>
            </div>
          )}

          {templatesForReason.length === 0 && reasonId && (
            <p className="text-xs text-muted-foreground">
              No email templates linked to this reason. Configure them in Settings → Email Templates.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || !reasonId}
          >
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

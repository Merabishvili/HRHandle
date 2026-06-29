'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { rejectApplicationsBatch } from '@/lib/actions/applications'
import type {
  RejectionReason,
  RejectionTemplate,
} from '@/components/pipeline/rejection-dialog'

const NO_TEMPLATE = '__none__'

export interface BatchRejectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Application IDs to reject. The caller is responsible for filtering out
   * already-rejected ones before passing them in. */
  applicationIds: string[]
  /** The rejected status id from the application_statuses lookup. */
  rejectedStatusId: string
  reasons: RejectionReason[]
  templates: RejectionTemplate[]
  /** Called after a successful rejection so the parent can clear its
   * selection state + refresh the list. */
  onSuccess: () => void
}

/**
 * Batch version of the single-row RejectionDialog. Same form shape (reason +
 * template + send-email toggle) — just operates on a list of applications and
 * shows a summary toast when done. Delegates to `rejectApplicationsBatch`,
 * which loops the existing single-row action so behaviour is identical
 * (status, candidate-status sync, template email).
 */
export function BatchRejectionDialog({
  open,
  onOpenChange,
  applicationIds,
  rejectedStatusId,
  reasons,
  templates,
  onSuccess,
}: BatchRejectionDialogProps) {
  const [reasonId, setReasonId] = useState<string>(reasons[0]?.id ?? '')
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE)
  const [sendEmail, setSendEmail] = useState(true)
  const [isPending, startTransition] = useTransition()

  // When dialog opens, reset to defaults so a previous use of the dialog
  // doesn't bleed selections into the next session.
  useEffect(() => {
    if (open) {
      const firstReason = reasons[0]?.id ?? ''
      setReasonId(firstReason)
      const linked = templates.find((t) => t.reason_id === firstReason)
      setTemplateId(linked?.id ?? (templates[0]?.id ?? NO_TEMPLATE))
      setSendEmail(true)
    }
  }, [open, reasons, templates])

  // When reason changes, auto-pick the template linked to that reason if any
  useEffect(() => {
    if (!reasonId) return
    const linked = templates.find((t) => t.reason_id === reasonId)
    if (linked) setTemplateId(linked.id)
  }, [reasonId, templates])

  const count = applicationIds.length

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await rejectApplicationsBatch({
        applicationIds,
        statusId: rejectedStatusId,
        rejectionReasonId: reasonId || null,
        templateId: sendEmail && templateId !== NO_TEMPLATE ? templateId : null,
        sendEmail,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      const { succeeded, failed } = result.data
      if (failed === 0) {
        toast.success(
          `Rejected ${succeeded} ${succeeded === 1 ? 'candidate' : 'candidates'}.`,
        )
      } else if (succeeded === 0) {
        toast.error(`Could not reject any of the ${count} selected candidates.`)
      } else {
        toast.warning(
          `Rejected ${succeeded}; ${failed} failed. Try the failed ones individually to see why.`,
        )
      }

      onOpenChange(false)
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reject {count} {count === 1 ? 'candidate' : 'candidates'}
          </DialogTitle>
          <DialogDescription>
            Marks each selected application as rejected. If &quot;Send rejection email&quot; is
            on, each candidate receives a personalised email using the template below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Rejection reason</Label>
            {reasons.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No rejection reasons configured. You can still reject — add reasons in
                Settings → Rejection reasons.
              </p>
            ) : (
              <SearchableSelect
                value={reasonId}
                onValueChange={setReasonId}
                disabled={isPending}
                placeholder="Select a reason…"
                searchPlaceholder="Search reasons…"
                emptyText="No reasons match your search."
                options={reasons.map((r) => ({
                  value: r.id,
                  label: r.name,
                  searchText: r.name,
                }))}
              />
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="batch-send-email" className="cursor-pointer font-medium">
              Send rejection email to each candidate
            </Label>
            <Switch
              id="batch-send-email"
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              disabled={isPending}
            />
          </div>

          {sendEmail && (
            <div className="space-y-1.5">
              <Label>Email template</Label>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates configured. A default email will be sent. Configure
                  templates in Settings → Email templates.
                </p>
              ) : (
                <SearchableSelect
                  value={templateId}
                  onValueChange={setTemplateId}
                  disabled={isPending}
                  placeholder="Select a template…"
                  searchPlaceholder="Search templates…"
                  emptyText="No templates match your search."
                  options={[
                    { value: NO_TEMPLATE, label: '— No template (use default) —' },
                    ...templates.map((t) => ({
                      value: t.id,
                      label: t.reason_id === reasonId && reasonId ? `${t.name} ✓` : t.name,
                      searchText: `${t.name} ${t.subject}`,
                    })),
                  ]}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || (reasons.length > 0 && !reasonId)}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting…
              </>
            ) : (
              `Reject ${count}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

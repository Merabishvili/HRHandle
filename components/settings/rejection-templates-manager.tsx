'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
import {
  createRejectionTemplate,
  updateRejectionTemplate,
  deleteRejectionTemplate,
  type RejectionTemplate,
} from '@/lib/actions/rejection-templates'
import type { RejectionReason } from '@/lib/actions/rejection-reasons'
import { rejectionReasonLabel } from '@/lib/rejection-i18n'
import { DEFAULT_REJECTION_SUBJECT, DEFAULT_REJECTION_BODY } from '@/lib/email-template-utils'
import { Plus, Trash2, Loader2, Pencil, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

const VARIABLES = ['{{candidate_name}}', '{{role}}', '{{company}}', '{{sender_name}}', '{{sender_email}}']
const NO_REASON = '__none__'

/** Render a template with sample data so admins see the real subject/body
 * before saving — same sample values as the other Email-template tabs. */
function renderRejectionPreview(text: string): string {
  return text
    .replaceAll('{{candidate_name}}', 'Jane Smith')
    .replaceAll('{{role}}', 'Senior Developer')
    .replaceAll('{{company}}', 'Acme Corp')
    .replaceAll('{{sender_name}}', 'Taylor Brooks')
    .replaceAll('{{sender_email}}', 'taylor@acme.com')
}

/** Localize known machine error codes from the server actions; other errors
 * (validation strings) are already human-readable and shown as-is. */
function displayTemplateError(tr: (key: string) => string, error: string): string {
  return error === 'reason_taken' ? tr('rejectTpl.reasonTaken') : error
}

/** Live subject + body preview panel, matching the other Email-template tabs. */
function RejectionPreview({ subject, body }: { subject: string; body: string }) {
  const tr = useTranslations()
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{tr('emailTpl.preview')}</Label>
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <p className="text-foreground">
          <span className="font-medium">{tr('emailTpl.subjectPrefix')}</span> {renderRejectionPreview(subject) || '—'}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
          {renderRejectionPreview(body) || '—'}
        </p>
      </div>
    </div>
  )
}

interface Props {
  initialTemplates: RejectionTemplate[]
  reasons: RejectionReason[]
}

function TemplateRow({
  template,
  reasons,
  onUpdated,
  onDeleted,
}: {
  template: RejectionTemplate
  reasons: RejectionReason[]
  onUpdated: (t: RejectionTemplate) => void
  onDeleted: (id: string) => void
}) {
  const tr = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [reasonId, setReasonId] = useState<string>(template.reason_id ?? NO_REASON)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const linkedReason = reasons.find((r) => r.id === template.reason_id)

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const resolvedReasonId = reasonId === NO_REASON ? null : reasonId
      const result = await updateRejectionTemplate(
        template.id,
        name,
        subject,
        body,
        resolvedReasonId
      )
      if (!result.success) { setError(displayTemplateError(tr, result.error)); return }
      onUpdated({ ...template, name, subject, body, reason_id: resolvedReasonId })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setName(template.name)
    setSubject(template.subject)
    setBody(template.body)
    setReasonId(template.reason_id ?? NO_REASON)
    setEditing(false)
    setError(null)
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteRejectionTemplate(template.id)
      if (!result.success) { setError(displayTemplateError(tr, result.error)); return }
      onDeleted(template.id)
    })
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="space-y-1.5">
          <Label className="text-xs">{tr('rejectTpl.templateName')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} maxLength={200} className="h-8 text-sm" />
        </div>
        {reasons.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('rejectTpl.linkedReason')}</Label>
            <Select value={reasonId} onValueChange={setReasonId} disabled={isPending}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={tr('rejectTpl.noneUnlinked')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REASON}>{tr('rejectTpl.noneUnlinked')}</SelectItem>
                {reasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{rejectionReasonLabel(tr, r.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">{tr('rejectTpl.subject')}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isPending} maxLength={500} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{tr('emailTpl.messageBody')}</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={isPending} maxLength={10000} rows={4} className="resize-none text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
            <X className="mr-1.5 h-3.5 w-3.5" /> {tr('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim() || !subject.trim() || !body.trim()}>
            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            {tr('common.save')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          className="flex-1 flex items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-sm font-medium text-foreground">{rejectionReasonLabel(tr, template.name)}</span>
          {linkedReason && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {tr('rejectTpl.reasonLabel', { name: rejectionReasonLabel(tr, linkedReason.name) })}
            </span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setExpanded(false) }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {confirmDelete ? (
            <>
              <span className="text-xs text-destructive">{tr('rejectTpl.deleteConfirm')}</span>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending} className="h-7 px-2 text-xs">
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : tr('rejectTpl.yes')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="h-7 px-2 text-xs">{tr('rejectTpl.no')}</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">{tr('emailTpl.subjectPrefix')}</span> {template.subject}</p>
            <p className="whitespace-pre-wrap"><span className="font-medium text-foreground">{tr('rejectTpl.bodyPrefix')}</span> {template.body}</p>
          </div>
          <RejectionPreview subject={template.subject} body={template.body} />
        </div>
      )}
    </div>
  )
}

export function RejectionTemplatesManager({ initialTemplates, reasons }: Props) {
  const tr = useTranslations()
  const [templates, setTemplates] = useState<RejectionTemplate[]>(initialTemplates)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newReasonId, setNewReasonId] = useState<string>(reasons[0]?.id ?? NO_REASON)
  const [newSubject, setNewSubject] = useState(DEFAULT_REJECTION_SUBJECT)
  const [newBody, setNewBody] = useState(DEFAULT_REJECTION_BODY)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    setError(null)
    startTransition(async () => {
      const resolvedNewReasonId = newReasonId === NO_REASON ? null : newReasonId
      const result = await createRejectionTemplate(newName, newSubject, newBody, resolvedNewReasonId)
      if (!result.success) { setError(displayTemplateError(tr, result.error)); return }
      setTemplates((prev) => [...prev, result.data])
      setNewName('')
      setNewReasonId(reasons[0]?.id ?? NO_REASON)
      setNewSubject(DEFAULT_REJECTION_SUBJECT)
      setNewBody(DEFAULT_REJECTION_BODY)
      setAdding(false)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {tr('rejectTpl.intro')}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{v}</code>
            ))}
          </div>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="shrink-0 ml-4">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> {tr('rejectTpl.addTemplate')}
          </Button>
        )}
      </div>

      {/* The add form shows its own error inline (below) — no duplicate banner here. */}

      {templates.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{tr('rejectTpl.empty')}</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              reasons={reasons}
              onUpdated={(updated) => setTemplates((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setTemplates((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">{tr('rejectTpl.newTemplate')}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('rejectTpl.templateName')}</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} disabled={isPending} placeholder={tr('rejectTpl.namePlaceholder')} maxLength={200} className="text-sm" />
          </div>
          {reasons.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">{tr('rejectTpl.linkedReason')}</Label>
              <Select value={newReasonId} onValueChange={setNewReasonId} disabled={isPending}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={tr('rejectTpl.noneUnlinked')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REASON}>{tr('rejectTpl.noneUnlinked')}</SelectItem>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{rejectionReasonLabel(tr, r.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('rejectTpl.subject')}</Label>
            <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} disabled={isPending} maxLength={500} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{tr('emailTpl.messageBody')}</Label>
            <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} disabled={isPending} maxLength={10000} rows={4} className="resize-none text-sm" />
          </div>
          <RejectionPreview subject={newSubject} body={newBody} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null) }} disabled={isPending}>{tr('common.cancel')}</Button>
            <Button size="sm" onClick={handleAdd} disabled={isPending || !newName.trim() || !newSubject.trim() || !newBody.trim()}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {tr('rejectTpl.saveTemplate')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

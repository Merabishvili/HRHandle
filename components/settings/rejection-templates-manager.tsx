'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  createRejectionTemplate,
  updateRejectionTemplate,
  deleteRejectionTemplate,
  DEFAULT_REJECTION_SUBJECT,
  DEFAULT_REJECTION_BODY,
  type RejectionTemplate,
} from '@/lib/actions/rejection-templates'
import { Plus, Trash2, Loader2, Pencil, X, Check, ChevronDown, ChevronUp } from 'lucide-react'

const VARIABLES = ['{{candidate_name}}', '{{role}}', '{{company}}']

interface Props {
  initialTemplates: RejectionTemplate[]
}

function TemplateRow({
  template,
  onUpdated,
  onDeleted,
}: {
  template: RejectionTemplate
  onUpdated: (t: RejectionTemplate) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateRejectionTemplate(template.id, name, subject, body)
      if (!result.success) { setError(result.error); return }
      onUpdated({ ...template, name, subject, body })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setName(template.name)
    setSubject(template.subject)
    setBody(template.body)
    setEditing(false)
    setError(null)
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteRejectionTemplate(template.id)
      if (!result.success) { setError(result.error); return }
      onDeleted(template.id)
    })
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="space-y-1.5">
          <Label className="text-xs">Template name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isPending} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Message body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={isPending} rows={4} className="resize-none text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim() || !subject.trim() || !body.trim()}>
            {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Save
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
          <span className="text-sm font-medium text-foreground">{template.name}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setExpanded(false) }} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {confirmDelete ? (
            <>
              <span className="text-xs text-destructive">Delete?</span>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending} className="h-7 px-2 text-xs">
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="h-7 px-2 text-xs">No</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-3 py-3 space-y-1.5 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Subject:</span> {template.subject}</p>
          <p><span className="font-medium text-foreground">Body:</span> {template.body}</p>
        </div>
      )}
    </div>
  )
}

export function RejectionTemplatesManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<RejectionTemplate[]>(initialTemplates)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState(DEFAULT_REJECTION_SUBJECT)
  const [newBody, setNewBody] = useState(DEFAULT_REJECTION_BODY)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    setError(null)
    startTransition(async () => {
      const result = await createRejectionTemplate(newName, newSubject, newBody)
      if (!result.success) { setError(result.error); return }
      setTemplates((prev) => [...prev, result.data])
      setNewName('')
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
            If no templates are configured, a built-in default is used. With multiple templates, you can choose which one to send during rejection.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{v}</code>
            ))}
          </div>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="shrink-0 ml-4">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Template
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No custom templates. The built-in default will be used.</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onUpdated={(updated) => setTemplates((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setTemplates((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-border bg-accent/30 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">New rejection template</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="space-y-1.5">
            <Label className="text-xs">Template name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} disabled={isPending} placeholder="e.g. Standard, Technical Role, Senior Position" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} disabled={isPending} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message body</Label>
            <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} disabled={isPending} rows={4} className="resize-none text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null) }} disabled={isPending}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={isPending || !newName.trim() || !newSubject.trim() || !newBody.trim()}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save Template
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

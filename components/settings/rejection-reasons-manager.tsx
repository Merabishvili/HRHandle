'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  createRejectionReason,
  updateRejectionReason,
  deleteRejectionReason,
  type RejectionReason,
} from '@/lib/actions/rejection-reasons'
import { Plus, Trash2, Loader2, Pencil, Check, X } from 'lucide-react'

const MAX_REASONS = 50

interface Props {
  initialReasons: RejectionReason[]
  /** IDs of reasons that have a linked email template — drives the per-reason
   * "Template configured" vs "Default copy" indicator. */
  reasonIdsWithTemplate?: string[]
}

function ReasonRow({
  reason,
  hasTemplate,
  onUpdated,
  onDeleted,
}: {
  reason: RejectionReason
  hasTemplate: boolean
  onUpdated: (r: RejectionReason) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(reason.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateRejectionReason(reason.id, name)
      if (!result.success) { setError(result.error); return }
      onUpdated({ ...reason, name })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setName(reason.name)
    setEditing(false)
    setError(null)
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteRejectionReason(reason.id)
      if (!result.success) { setError(result.error); return }
      onDeleted(reason.id)
    })
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-accent/30 p-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            disabled={isPending}
            maxLength={200}
            autoFocus
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending} className="h-8 w-8 p-0">
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()} className="h-8 px-2">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className="text-sm text-foreground">{reason.name}</span>
      {hasTemplate ? (
        <a
          href="/settings/email-templates"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:underline"
          title="This reason has a linked email template"
        >
          <Check className="h-3 w-3" aria-hidden />
          Template configured
        </a>
      ) : (
        <a
          href="/settings/email-templates"
          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:underline"
          title="No template linked — the default rejection copy is used"
        >
          No template · default copy
        </a>
      )}
      <span className="flex-1" />
      {error && <span className="text-xs text-destructive">{error}</span>}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm" variant="ghost"
          onClick={() => setEditing(true)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
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
          <Button
            size="sm" variant="ghost" onClick={handleDelete}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function RejectionReasonsManager({ initialReasons, reasonIdsWithTemplate = [] }: Props) {
  const [reasons, setReasons] = useState<RejectionReason[]>(initialReasons)
  const templateSet = new Set(reasonIdsWithTemplate)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const atLimit = reasons.length >= MAX_REASONS

  const handleAdd = () => {
    if (!newName.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await createRejectionReason(newName.trim())
      if (!result.success) { setError(result.error); return }
      setReasons((prev) => [...prev, result.data])
      setNewName('')
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These reasons appear when moving a candidate to a rejected stage. During rejection, you can choose whether to send an email to the candidate.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reasons.length > 0 ? (
        <div className="space-y-2">
          {reasons.map((r) => (
            <ReasonRow
              key={r.id}
              reason={r}
              hasTemplate={templateSet.has(r.id)}
              onUpdated={(updated) => setReasons((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDeleted={(id) => setReasons((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No rejection reasons yet.</p>
      )}

      {!atLimit && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="e.g. Overqualified, Salary mismatch, No response…"
            disabled={isPending}
            maxLength={200}
            className="text-sm"
          />
          <Button size="sm" onClick={handleAdd} disabled={isPending || !newName.trim()}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{reasons.length} / {MAX_REASONS} reasons</p>
    </div>
  )
}

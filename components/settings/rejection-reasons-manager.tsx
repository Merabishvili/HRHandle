'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  createRejectionReason,
  updateRejectionReason,
  deleteRejectionReason,
  type RejectionReason,
} from '@/lib/actions/rejection-reasons'
import { Plus, Trash2, Loader2, Pencil, Check, X, Mail } from 'lucide-react'

const MAX_REASONS = 50

interface Props {
  initialReasons: RejectionReason[]
}

function ReasonRow({
  reason,
  onUpdated,
  onDeleted,
}: {
  reason: RejectionReason
  onUpdated: (r: RejectionReason) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(reason.name)
  const [sendEmail, setSendEmail] = useState(reason.send_email)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateRejectionReason(reason.id, name, sendEmail)
      if (!result.success) { setError(result.error); return }
      onUpdated({ ...reason, name, send_email: sendEmail })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setName(reason.name)
    setSendEmail(reason.send_email)
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          autoFocus
          className="h-8 text-sm"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id={`send-${reason.id}`}
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              disabled={isPending}
            />
            <Label htmlFor={`send-${reason.id}`} className="text-xs text-muted-foreground cursor-pointer">
              Send rejection email
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending} className="h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()} className="h-7 px-2">
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{reason.name}</span>
        {reason.send_email && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" /> email
          </span>
        )}
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
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
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="h-7 px-2 text-xs">
              No
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function RejectionReasonsManager({ initialReasons }: Props) {
  const [reasons, setReasons] = useState<RejectionReason[]>(initialReasons)
  const [newName, setNewName] = useState('')
  const [newSendEmail, setNewSendEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const atLimit = reasons.length >= MAX_REASONS

  const handleAdd = () => {
    if (!newName.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await createRejectionReason(newName.trim(), newSendEmail)
      if (!result.success) { setError(result.error); return }
      setReasons((prev) => [...prev, result.data])
      setNewName('')
      setNewSendEmail(false)
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Rejection reasons are shown when moving a candidate to a rejected stage.
        Enable <strong className="text-foreground">Send rejection email</strong> on a reason to automatically offer sending an email to the candidate when that reason is selected.
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Existing reasons */}
      {reasons.length > 0 ? (
        <div className="space-y-2">
          {reasons.map((r) => (
            <ReasonRow
              key={r.id}
              reason={r}
              onUpdated={(updated) =>
                setReasons((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
              onDeleted={(id) =>
                setReasons((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No rejection reasons yet. Add one below.</p>
      )}

      {/* Add new */}
      {!atLimit && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium text-foreground">Add a reason</p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="e.g. Overqualified, Salary mismatch, No response…"
            disabled={isPending}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="new-send-email"
                checked={newSendEmail}
                onCheckedChange={setNewSendEmail}
                disabled={isPending}
              />
              <Label htmlFor="new-send-email" className="text-sm text-muted-foreground cursor-pointer">
                Send rejection email when selected
              </Label>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isPending || !newName.trim()}
            >
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {reasons.length} / {MAX_REASONS} reasons used
      </p>
    </div>
  )
}

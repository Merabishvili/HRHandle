'use client'

import { useState, useTransition } from 'react'
import {
  createExperienceEntry,
  updateExperienceEntry,
  deleteExperienceEntry,
} from '@/lib/actions/candidate-background'
import type { CandidateExperience } from '@/lib/types/candidate'
import type { ExperienceEntryInput } from '@/lib/validations/candidate-background'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Pencil, Trash2, X, Check, Briefcase } from 'lucide-react'

interface ExperienceSectionProps {
  candidateId: string
  initialEntries: CandidateExperience[]
}

const BLANK: ExperienceEntryInput = {
  company: '',
  title: '',
  start_date: null,
  end_date: null,
  is_current: false,
  description: null,
}

interface EntryFormProps {
  value: ExperienceEntryInput
  onChange: (v: ExperienceEntryInput) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}

function EntryForm({ value, onChange, onSave, onCancel, isPending, error }: EntryFormProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Company *</Label>
          <Input
            value={value.company}
            onChange={(e) => onChange({ ...value, company: e.target.value })}
            placeholder="Company name"
            maxLength={200}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Title *</Label>
          <Input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Job title"
            maxLength={200}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Start date</Label>
          <Input
            type="month"
            value={value.start_date ?? ''}
            onChange={(e) => onChange({ ...value, start_date: e.target.value || null })}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End date</Label>
          <Input
            type="month"
            value={value.end_date ?? ''}
            onChange={(e) => onChange({ ...value, end_date: e.target.value || null })}
            disabled={isPending || value.is_current}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_current}
          onChange={(e) => onChange({ ...value, is_current: e.target.checked, end_date: e.target.checked ? null : value.end_date })}
          disabled={isPending}
          className="rounded"
        />
        Currently working here
      </label>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={value.description ?? ''}
          onChange={(e) => onChange({ ...value, description: e.target.value || null })}
          placeholder="Role description (optional)"
          rows={2}
          maxLength={1000}
          disabled={isPending}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isPending || !value.company.trim() || !value.title.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  )
}

export function ExperienceSection({ candidateId, initialEntries }: ExperienceSectionProps) {
  const [entries, setEntries] = useState<CandidateExperience[]>(initialEntries)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<ExperienceEntryInput>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ExperienceEntryInput>(BLANK)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    setError(null)
    startTransition(async () => {
      const result = await createExperienceEntry(candidateId, addForm)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => [
        { ...addForm, id: result.data.id, organization_id: '', candidate_id: candidateId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as CandidateExperience,
        ...prev,
      ])
      setAdding(false)
      setAddForm(BLANK)
    })
  }

  const handleEdit = (entry: CandidateExperience) => {
    setEditingId(entry.id)
    setEditForm({
      company: entry.company,
      title: entry.title,
      start_date: entry.start_date ?? null,
      end_date: entry.end_date ?? null,
      is_current: entry.is_current,
      description: entry.description ?? null,
    })
    setError(null)
  }

  const handleUpdate = () => {
    if (!editingId) return
    setError(null)
    startTransition(async () => {
      const result = await updateExperienceEntry(editingId, candidateId, editForm)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => prev.map((e) =>
        e.id === editingId ? { ...e, ...editForm } : e
      ))
      setEditingId(null)
    })
  }

  const handleDelete = (id: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteExperienceEntry(id, candidateId)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => prev.filter((e) => e.id !== id))
    })
  }

  function formatDateRange(entry: CandidateExperience) {
    const start = entry.start_date ? entry.start_date.slice(0, 7) : null
    const end = entry.is_current ? 'Present' : entry.end_date ? entry.end_date.slice(0, 7) : null
    if (!start && !end) return null
    return [start, end].filter(Boolean).join(' – ')
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4" />
          Experience
        </CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => { setAdding(true); setAddForm(BLANK); setError(null) }} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && !adding && !editingId && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {adding && (
          <EntryForm
            value={addForm}
            onChange={setAddForm}
            onSave={handleAdd}
            onCancel={() => { setAdding(false); setError(null) }}
            isPending={isPending}
            error={adding ? error : null}
          />
        )}

        {entries.length === 0 && !adding && (
          <p className="py-4 text-center text-sm text-muted-foreground">No experience added yet.</p>
        )}

        {entries.map((entry) => (
          <div key={entry.id}>
            {editingId === entry.id ? (
              <EntryForm
                value={editForm}
                onChange={setEditForm}
                onSave={handleUpdate}
                onCancel={() => { setEditingId(null); setError(null) }}
                isPending={isPending}
                error={editingId === entry.id ? error : null}
              />
            ) : (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{entry.company}</p>
                  {formatDateRange(entry) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateRange(entry)}</p>
                  )}
                  {entry.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEdit(entry)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(entry.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

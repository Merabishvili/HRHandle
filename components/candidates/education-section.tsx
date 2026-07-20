'use client'

import { useState, useTransition } from 'react'
import {
  createEducationEntry,
  updateEducationEntry,
  deleteEducationEntry,
} from '@/lib/actions/candidate-background'
import type { CandidateEducation } from '@/lib/types/candidate'
import type { EducationEntryInput } from '@/lib/validations/candidate-background'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Pencil, Trash2, X, Check, GraduationCap, ChevronDown } from 'lucide-react'

interface EducationSectionProps {
  candidateId: string
  initialEntries: CandidateEducation[]
}

const BLANK: EducationEntryInput = {
  institution: '',
  degree: null,
  field_of_study: null,
  start_year: null,
  end_year: null,
  is_ongoing: false,
}

interface EntryFormProps {
  value: EducationEntryInput
  onChange: (v: EducationEntryInput) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}

function EntryForm({ value, onChange, onSave, onCancel, isPending, error }: EntryFormProps) {
  const currentYear = new Date().getFullYear()
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Institution *</Label>
        <Input
          value={value.institution}
          onChange={(e) => onChange({ ...value, institution: e.target.value })}
          placeholder="University or school name"
          maxLength={200}
          disabled={isPending}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Degree</Label>
          <Input
            value={value.degree ?? ''}
            onChange={(e) => onChange({ ...value, degree: e.target.value || null })}
            placeholder="e.g. Bachelor's, Master's"
            maxLength={100}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Field of Study</Label>
          <Input
            value={value.field_of_study ?? ''}
            onChange={(e) => onChange({ ...value, field_of_study: e.target.value || null })}
            placeholder="e.g. Computer Science"
            maxLength={200}
            disabled={isPending}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Start year</Label>
          <Input
            type="number"
            min={1900}
            max={currentYear}
            value={value.start_year ?? ''}
            onChange={(e) => onChange({ ...value, start_year: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder={String(currentYear - 4)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End year</Label>
          <Input
            type="number"
            min={1900}
            max={currentYear + 10}
            value={value.end_year ?? ''}
            onChange={(e) => onChange({ ...value, end_year: e.target.value ? parseInt(e.target.value, 10) : null })}
            placeholder={String(currentYear)}
            disabled={isPending || value.is_ongoing}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_ongoing}
          onChange={(e) => onChange({ ...value, is_ongoing: e.target.checked, end_year: e.target.checked ? null : value.end_year })}
          disabled={isPending}
          className="rounded"
        />
        Currently studying here
      </label>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isPending || !value.institution.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  )
}

export function EducationSection({ candidateId, initialEntries }: EducationSectionProps) {
  const [entries, setEntries] = useState<CandidateEducation[]>(initialEntries)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<EducationEntryInput>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EducationEntryInput>(BLANK)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // A-12c — Collapse the section body on mobile by default. Mirrors
  // ExperienceSection. Always expanded on sm+.
  const [collapsedOnMobile, setCollapsedOnMobile] = useState(true)

  const handleAdd = () => {
    setError(null)
    startTransition(async () => {
      const result = await createEducationEntry(candidateId, addForm)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => [
        { ...addForm, id: result.data.id, organization_id: '', candidate_id: candidateId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as CandidateEducation,
        ...prev,
      ])
      setAdding(false)
      setAddForm(BLANK)
    })
  }

  const handleEdit = (entry: CandidateEducation) => {
    setEditingId(entry.id)
    setEditForm({
      institution: entry.institution,
      degree: entry.degree ?? null,
      field_of_study: entry.field_of_study ?? null,
      start_year: entry.start_year ?? null,
      end_year: entry.end_year ?? null,
      is_ongoing: entry.is_ongoing,
    })
    setError(null)
  }

  const handleUpdate = () => {
    if (!editingId) return
    setError(null)
    startTransition(async () => {
      const result = await updateEducationEntry(editingId, candidateId, editForm)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => prev.map((e) =>
        e.id === editingId ? ({ ...e, ...editForm } as CandidateEducation) : e
      ))
      setEditingId(null)
    })
  }

  const handleDelete = (id: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteEducationEntry(id, candidateId)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => prev.filter((e) => e.id !== id))
    })
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <button
            type="button"
            onClick={() => setCollapsedOnMobile((v) => !v)}
            className="flex items-center gap-2 text-left sm:cursor-default"
            aria-expanded={!collapsedOnMobile}
          >
            <GraduationCap className="h-4 w-4" />
            Education
            {entries.length > 0 && (
              <span className="text-[12px] font-normal text-muted-foreground">({entries.length})</span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform sm:hidden ${!collapsedOnMobile ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        </CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => { setAdding(true); setAddForm(BLANK); setError(null); setCollapsedOnMobile(false) }} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className={`space-y-3 ${collapsedOnMobile ? 'hidden sm:block' : ''}`}>
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
          <p className="py-4 text-center text-sm text-muted-foreground">No education added yet.</p>
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
                  <p className="text-sm font-medium truncate">{entry.institution}</p>
                  {(entry.degree || entry.field_of_study) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {[entry.degree, entry.field_of_study].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {(entry.start_year || entry.end_year || entry.is_ongoing) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.start_year ?? '?'} – {entry.is_ongoing ? 'Present' : (entry.end_year ?? '?')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Edit education entry"
                    onClick={() => handleEdit(entry)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label="Delete education entry"
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

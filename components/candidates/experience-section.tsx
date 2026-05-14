'use client'

import { useState, useTransition } from 'react'
import {
  createExperienceEntry,
  updateExperienceEntry,
  deleteExperienceEntry,
} from '@/lib/actions/candidate-background'
import type { CandidateExperience } from '@/lib/types/candidate'
import type { ExperienceEntryInput } from '@/lib/validations/candidate-background'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Pencil, Trash2, X, Check, Briefcase, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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
          <Input value={value.company} onChange={(e) => onChange({ ...value, company: e.target.value })} placeholder="Company name" maxLength={200} disabled={isPending} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Title *</Label>
          <Input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Job title" maxLength={200} disabled={isPending} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Start date</Label>
          <Input type="month" value={value.start_date ?? ''} onChange={(e) => onChange({ ...value, start_date: e.target.value || null })} disabled={isPending} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End date</Label>
          <Input type="month" value={value.end_date ?? ''} onChange={(e) => onChange({ ...value, end_date: e.target.value || null })} disabled={isPending || value.is_current} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={value.is_current} onChange={(e) => onChange({ ...value, is_current: e.target.checked, end_date: e.target.checked ? null : value.end_date })} disabled={isPending} className="rounded" />
        Currently working here
      </label>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea value={value.description ?? ''} onChange={(e) => onChange({ ...value, description: e.target.value || null })} placeholder="Role description (optional)" rows={2} maxLength={1000} disabled={isPending} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={isPending || !value.company.trim() || !value.title.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Save
        </Button>
      </div>
    </div>
  )
}

function formatDateRange(entry: CandidateExperience): string | null {
  const fmt = (d: string) => d.slice(0, 7)
  const start = entry.start_date ? fmt(entry.start_date) : null
  const end   = entry.is_current ? 'Present' : entry.end_date ? fmt(entry.end_date) : null
  if (!start && !end) return null

  // duration in months
  let duration = ''
  if (start && (entry.end_date || entry.is_current)) {
    const s = new Date(entry.start_date!)
    const e = entry.is_current ? new Date() : new Date(entry.end_date!)
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
    const yrs = Math.floor(months / 12)
    const mos = months % 12
    duration = yrs > 0 ? `${yrs}y ${mos > 0 ? mos + 'mo' : ''}`.trim() : `${mos}mo`
  }

  return [start && end ? `${start} — ${end}` : start ?? end, duration].filter(Boolean).join(' · ')
}

export function ExperienceSection({ candidateId, initialEntries }: ExperienceSectionProps) {
  const [entries, setEntries]     = useState<CandidateExperience[]>(initialEntries)
  const [adding, setAdding]       = useState(false)
  const [addForm, setAddForm]     = useState<ExperienceEntryInput>(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<ExperienceEntryInput>(BLANK)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(initialEntries[0] ? [initialEntries[0].id] : []))
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleAdd = () => {
    setError(null)
    startTransition(async () => {
      const result = await createExperienceEntry(candidateId, addForm)
      if (!result.success) { setError(result.error); return }
      const newEntry = { ...addForm, id: result.data.id, organization_id: '', candidate_id: candidateId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as CandidateExperience
      setEntries((prev) => [newEntry, ...prev])
      setExpandedIds((prev) => { const s = new Set(prev); s.add(result.data.id); return s })
      setAdding(false)
      setAddForm(BLANK)
    })
  }

  const handleEdit = (entry: CandidateExperience) => {
    setEditingId(entry.id)
    setEditForm({ company: entry.company, title: entry.title, start_date: entry.start_date ?? null, end_date: entry.end_date ?? null, is_current: entry.is_current, description: entry.description ?? null })
    setError(null)
  }

  const handleUpdate = () => {
    if (!editingId) return
    setError(null)
    startTransition(async () => {
      const result = await updateExperienceEntry(editingId, candidateId, editForm)
      if (!result.success) { setError(result.error); return }
      setEntries((prev) => prev.map((e) => e.id === editingId ? { ...e, ...editForm } : e))
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

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span className="text-[15px] font-bold text-foreground">Experience</span>
          {entries.length > 0 && <span className="text-[12px] text-muted-foreground">({entries.length})</span>}
        </div>
        {!adding && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setAdding(true); setAddForm(BLANK); setError(null) }} disabled={isPending}>
            <Plus className="h-3.5 w-3.5" />Add
          </Button>
        )}
      </div>

      {error && !adding && !editingId && (
        <Alert variant="destructive" className="mb-3 py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {adding && (
        <div className="mb-3">
          <EntryForm value={addForm} onChange={setAddForm} onSave={handleAdd} onCancel={() => { setAdding(false); setError(null) }} isPending={isPending} error={adding ? error : null} />
        </div>
      )}

      {entries.length === 0 && !adding && (
        <p className="py-4 text-center text-sm text-muted-foreground">No experience added yet.</p>
      )}

      {/* Timeline */}
      {entries.length > 0 && (
        <div className="relative pl-[18px]">
          {/* Rail */}
          <div className="absolute left-[5px] top-[6px] bottom-[6px] w-px bg-border" />

          {entries.map((entry, idx) => {
            const isFirst    = idx === 0
            const isExpanded = expandedIds.has(entry.id)
            const isEditing  = editingId === entry.id
            const dateRange  = formatDateRange(entry)

            return (
              <div key={entry.id} className="relative mb-2 last:mb-0">
                {/* Dot */}
                <div className={cn(
                  'absolute -left-[18px] top-[13px] h-[11px] w-[11px] rounded-full border-2',
                  isFirst ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.55_0.18_250)]' : 'border-border bg-card'
                )} />

                {isEditing ? (
                  <EntryForm value={editForm} onChange={setEditForm} onSave={handleUpdate} onCancel={() => { setEditingId(null); setError(null) }} isPending={isPending} error={editingId === entry.id ? error : null} />
                ) : (
                  <div className={cn('rounded-lg transition-colors', isExpanded ? 'border border-border bg-muted/40' : '')}>
                    {/* Row header — clickable to expand */}
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">
                          {entry.title}
                          <span className="mx-1.5 text-[12.5px] font-normal text-muted-foreground">·</span>
                          <span className="text-[12.5px] font-normal text-muted-foreground">{entry.company}</span>
                        </p>
                        {dateRange && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{dateRange}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pt-0.5">
                        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', isExpanded && 'rotate-180')} />
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="border-t border-border px-3 pb-3 pt-2">
                        {entry.description ? (
                          <p className="text-[12.5px] leading-[1.55] text-muted-foreground">{entry.description}</p>
                        ) : (
                          <p className="text-[12px] italic text-muted-foreground/60">No description.</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleEdit(entry)} disabled={isPending}>
                            <Pencil className="h-3 w-3" />Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)} disabled={isPending}>
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

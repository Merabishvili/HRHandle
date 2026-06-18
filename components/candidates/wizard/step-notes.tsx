'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export interface NotesState {
  initialNote: string
}

interface StepNotesProps {
  value: NotesState
  onChange: (next: NotesState) => void
}

/**
 * Wave 2.7 candidate wizard — Step 4 / Notes per Create Candidate
 * Steps.dc.html.
 *
 * Optional first-note card. The "Save & add another" footer action
 * (handled by the orchestrator) supports bulk sourcing sessions —
 * recruiters can clear the form and start a new candidate without
 * leaving the wizard.
 */
export function StepNotes({ value, onChange }: StepNotesProps) {
  return (
    <div className="flex max-w-[900px] flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">Notes</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Add an initial note about this candidate (optional).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note" className="sr-only">
          Initial note
        </Label>
        <Textarea
          id="note"
          value={value.initialNote}
          onChange={(e) => onChange({ initialNote: e.target.value })}
          placeholder="e.g. Strong referral from Nino. Background in fintech. Prefer afternoon interviews."
          rows={5}
          maxLength={2000}
        />
        <p className="text-right text-[11px] text-muted-foreground/80">
          {value.initialNote.length} / 2000
        </p>
      </div>
    </div>
  )
}

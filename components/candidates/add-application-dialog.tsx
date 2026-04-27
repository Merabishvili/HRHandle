'use client'

import { useState, useTransition } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { createApplication } from '@/lib/actions/applications'

interface Vacancy {
  id: string
  title: string
  department: string | null
}

interface AddApplicationDialogProps {
  candidateId: string
  availableVacancies: Vacancy[]
  activeApplicationCount: number
}

export function AddApplicationDialog({
  candidateId,
  availableVacancies,
  activeApplicationCount,
}: AddApplicationDialogProps) {
  const [open, setOpen] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const atLimit = activeApplicationCount >= 5

  const handleSubmit = () => {
    if (!vacancyId) { setError('Please select a vacancy.'); return }
    setError(null)
    startTransition(async () => {
      const result = await createApplication({ candidateId, vacancyId })
      if (result.success) {
        setOpen(false)
        setVacancyId('')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setVacancyId(''); setError(null) } }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={atLimit} title={atLimit ? 'Already being considered for 5 vacancies' : undefined}>
          <Plus className="mr-1 h-4 w-4" />
          Add to Vacancy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Vacancy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {atLimit && (
            <p className="text-sm text-destructive">
              This candidate is already being considered for 5 vacancies. Move or close one before adding a new one.
            </p>
          )}
          <div className="space-y-2">
            <Label>Vacancy</Label>
            {availableVacancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open vacancies available to apply to.</p>
            ) : (
              <Select value={vacancyId} onValueChange={setVacancyId} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vacancy…" />
                </SelectTrigger>
                <SelectContent>
                  {availableVacancies.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="font-medium">{v.title}</span>
                      {v.department && <span className="ml-2 text-muted-foreground text-xs">{v.department}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !vacancyId || availableVacancies.length === 0}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

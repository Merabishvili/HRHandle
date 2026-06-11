'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { saveView } from '@/lib/actions/saved-views'
import { type SavedViewKind } from '@/lib/saved-views/list-kinds'

export interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: SavedViewKind
  /** The current URL search-params shape to persist with the new view. */
  params: Record<string, string>
}

// Simple "name + Save" dialog used by SavedViewsMenu to capture a new view.
// The active filter state is passed in as `params` — recruiter doesn't need
// to think about what's being saved.
export function SaveViewDialog({
  open,
  onOpenChange,
  kind,
  params,
}: SaveViewDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveView(kind, name, params)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`Saved "${result.data.name}".`)
      setName('')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Give this filter combination a name. You can load it again from the
            Views dropdown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sv-name">View name</Label>
            <Input
              id="sv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Engineers in Tbilisi"
              maxLength={60}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim().length > 0) {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending || name.trim().length === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save view'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

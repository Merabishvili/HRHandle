'use client'

import { useEffect, useState, useTransition } from 'react'
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

import { renameView } from '@/lib/actions/saved-views'

export interface RenameViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewId: string
  currentName: string
}

// Tiny dialog for renaming a saved view. Mirror of SaveViewDialog but
// pre-populates the input and routes to the rename action.
export function RenameViewDialog({
  open,
  onOpenChange,
  viewId,
  currentName,
}: RenameViewDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setName(currentName)
      setError(null)
    }
  }, [open, currentName])

  const handleRename = () => {
    setError(null)
    const trimmed = name.trim()
    if (trimmed === currentName) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      const result = await renameView(viewId, name)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`Renamed to "${result.data.name}".`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
          <DialogDescription>
            The view&apos;s saved filters stay the same — only the name changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rv-name">View name</Label>
            <Input
              id="rv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim().length > 0) {
                  e.preventDefault()
                  handleRename()
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
          <Button
            type="button"
            onClick={handleRename}
            disabled={isPending || name.trim().length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Renaming…
              </>
            ) : (
              'Rename'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

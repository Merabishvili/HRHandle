'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  Edit3,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import {
  buildHrefForView,
  encodeParams,
  paramsAreEqual,
} from '@/lib/saved-views/filter-encoding'
import { SAVED_VIEW_CONFIG, type SavedViewKind } from '@/lib/saved-views/list-kinds'
import { deleteView, updateViewParams, type SavedView } from '@/lib/actions/saved-views'

import { SaveViewDialog } from './save-view-dialog'
import { RenameViewDialog } from './rename-view-dialog'

export interface SavedViewsMenuProps {
  kind: SavedViewKind
  views: SavedView[]
  /** Live URL params for the page right now (read from useSearchParams or
   * passed down from a server component). Used to detect "current filter
   * matches a saved view" and "active view has been modified." */
  currentParams: Record<string, string>
}

export function SavedViewsMenu({ kind, views, currentParams }: SavedViewsMenuProps) {
  const router = useRouter()
  const [saveOpen, setSaveOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Normalise once so all the comparisons agree.
  const encodedCurrent = useMemo(
    () => encodeParams(kind, currentParams),
    [kind, currentParams],
  )

  // Find the view (if any) whose persisted params match what the recruiter
  // is looking at right now. That's the "loaded" view — the dropdown labels
  // its row with a check and surfaces the inline action buttons.
  const activeView = useMemo(
    () => views.find((v) => paramsAreEqual(v.params, encodedCurrent)) ?? null,
    [views, encodedCurrent],
  )

  // If we have an active view but the recruiter has also touched a filter
  // since loading, render the "modified" badge so it's obvious that the URL
  // is no longer the saved shape. (Reaching this state means the current
  // filter shape doesn't match anything — `activeView` would be null.)
  const isModifiedFromSomeView =
    !activeView && views.some((v) => isProperSubsetOrTweak(v.params, encodedCurrent))

  const handleUpdate = (view: SavedView) => {
    setUpdatingId(view.id)
    startTransition(async () => {
      const result = await updateViewParams(view.id, currentParams)
      setUpdatingId(null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`"${result.data.name}" updated to match current filters.`)
      router.refresh()
    })
  }

  const handleDelete = (view: SavedView) => {
    if (!window.confirm(`Delete the view "${view.name}"?`)) return
    setDeletingId(view.id)
    startTransition(async () => {
      const result = await deleteView(view.id)
      setDeletingId(null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Deleted "${view.name}".`)
      // If the deleted view was the active one, reset filters by navigating
      // to the base path so the dropdown chooser is sensible again.
      if (activeView?.id === view.id) {
        router.push(SAVED_VIEW_CONFIG[kind].basePath)
      } else {
        router.refresh()
      }
    })
  }

  const triggerLabel = activeView
    ? activeView.name
    : views.length === 0
      ? 'Views'
      : 'Views'

  const showSaveCurrent =
    Object.keys(encodedCurrent).length > 0 && !activeView

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 max-w-[200px]">
              <span className="truncate">{triggerLabel}</span>
              {isModifiedFromSomeView && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] uppercase">
                  Modified
                </Badge>
              )}
              <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {views.length === 0 ? (
              <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                No saved views yet.
              </DropdownMenuLabel>
            ) : (
              <>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Your views
                </DropdownMenuLabel>
                {views.map((v) => {
                  const isActive = activeView?.id === v.id
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      onSelect={(e) => {
                        e.preventDefault()
                        router.push(buildHrefForView(kind, v.params))
                      }}
                      className="flex items-start gap-2"
                    >
                      <div className="mt-0.5 w-4 shrink-0">
                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v.name}</p>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
                {activeView && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Active: {activeView.name}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleUpdate(activeView)
                      }}
                      disabled={isPending}
                    >
                      {updatingId === activeView.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Update with current filters
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        setRenameTarget(activeView)
                      }}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleDelete(activeView)
                      }}
                      disabled={isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      {deletingId === activeView.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {showSaveCurrent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => setSaveOpen(true)}
          >
            <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
            Save current
          </Button>
        )}
      </div>

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        kind={kind}
        params={currentParams}
      />
      {renameTarget && (
        <RenameViewDialog
          open={!!renameTarget}
          onOpenChange={(o) => !o && setRenameTarget(null)}
          viewId={renameTarget.id}
          currentName={renameTarget.name}
        />
      )}
    </>
  )
}

// Heuristic — used only for the "Modified" badge — that detects whether
// the current filter is close to (but not exactly) some saved view. Returns
// true when at least one persisted key is still present with the same
// value, but the encoded shapes differ. Cheaper than a full diff UI; just a
// gentle "did you mean to update?" hint.
function isProperSubsetOrTweak(
  saved: Record<string, string>,
  current: Record<string, string>,
): boolean {
  if (paramsAreEqual(saved, current)) return false
  let sharedKey = false
  for (const [k, v] of Object.entries(saved)) {
    if (current[k] === v) {
      sharedKey = true
      break
    }
  }
  return sharedKey
}

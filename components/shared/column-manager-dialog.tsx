'use client'

import { useState } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ColumnDef } from '@/lib/types/columns'
import { MAX_OPTIONAL_COLUMNS } from '@/lib/types/columns'

interface SortableItemProps {
  id: string
  label: string
  onRemove: (id: string) => void
}

function SortableItem({ id, label, onRemove }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <button
        onClick={() => onRemove(id)}
        className="text-muted-foreground transition-colors hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface ColumnManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allColumns: ColumnDef[]
  fixedColumns: { label: string }[]
  selectedColumns: string[]
  onSave: (columns: string[]) => Promise<void>
}

export function ColumnManagerDialog({
  open,
  onOpenChange,
  allColumns,
  fixedColumns,
  selectedColumns: initialSelected,
  onSave,
}: ColumnManagerDialogProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSelected((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function removeColumn(key: string) {
    setSelected((prev) => prev.filter((c) => c !== key))
  }

  function addColumn(key: string) {
    if (selected.length < MAX_OPTIONAL_COLUMNS) {
      setSelected((prev) => [...prev, key])
    }
  }

  async function handleSave() {
    setSaving(true)
    await onSave(selected)
    setSaving(false)
    onOpenChange(false)
  }

  function handleCancel() {
    setSelected(initialSelected)
    onOpenChange(false)
  }

  const available = allColumns.filter((c) => !selected.includes(c.key))
  const selectedDefs = selected.map((key) => allColumns.find((c) => c.key === key)!).filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fixed columns */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fixed columns
            </p>
            <div className="space-y-1.5">
              {fixedColumns.map((col) => (
                <div
                  key={col.label}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                  <span className="flex-1 text-sm text-muted-foreground">{col.label}</span>
                  <Badge variant="secondary" className="text-[10px]">Fixed</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Selected optional columns */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Optional columns
              <span className="ml-1.5 font-normal normal-case text-foreground">
                ({selected.length}/{MAX_OPTIONAL_COLUMNS})
              </span>
            </p>

            {selectedDefs.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {selectedDefs.map((col) => (
                      <SortableItem
                        key={col.key}
                        id={col.key}
                        label={col.label}
                        onRemove={removeColumn}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">
                No optional columns selected
              </p>
            )}
          </div>

          {/* Available columns to add */}
          {available.length > 0 && selected.length < MAX_OPTIONAL_COLUMNS && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add columns
              </p>
              <div className="flex flex-wrap gap-2">
                {available.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => addColumn(col.key)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected.length >= MAX_OPTIONAL_COLUMNS && available.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Remove a column above to add a different one.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

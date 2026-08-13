'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  Circle,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import {
  createPipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  updatePipelineStage,
  type PipelineStageType,
} from '@/lib/actions/pipeline-stages'

const STAGE_CAP = 10

export interface PipelineStageRow {
  id: string
  name: string
  type: PipelineStageType
  is_terminal: boolean
  sort_order: number
}

interface PipelineStagesManagerProps {
  vacancyId: string
  initialStages: PipelineStageRow[]
  canEdit: boolean
}

const TYPE_META: Record<PipelineStageType, { labelKey: string; icon: typeof Users; descKey: string }> = {
  standard: {
    labelKey: 'pipeStages.typeStandard',
    icon: Circle,
    descKey: 'pipeStages.typeStandardDesc',
  },
  review: {
    labelKey: 'pipeStages.typeReview',
    icon: Sparkles,
    descKey: 'pipeStages.typeReviewDesc',
  },
  interview: {
    labelKey: 'pipeStages.typeInterview',
    icon: Users,
    descKey: 'pipeStages.typeInterviewDesc',
  },
  offer: {
    labelKey: 'pipeStages.typeOffer',
    icon: Check,
    descKey: 'pipeStages.typeOfferDesc',
  },
}

/**
 * Wave 2.6 Slice 3 — Pipeline Stages Manager per `Custom Stages.dc.html`.
 *
 * A stage = name (free text, any language) + type (Standard / Review /
 * Interview / Offer). Behaviour on the candidate profile is driven by
 * `type`, so naming the round "HR / Technical / Final" or "Interview
 * 1/2/3" all just work.
 *
 * Cap-10 per vacancy is enforced by the DB trigger added in Migration
 * 046; the "Add stage" button disables locally too so the recruiter
 * sees the limit before the action fires.
 */
export function PipelineStagesManager({
  vacancyId,
  initialStages,
  canEdit,
}: PipelineStagesManagerProps) {
  const tr = useTranslations()
  const router = useRouter()
  const [stages, setStages] = useState(initialStages)
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const atCap = stages.length >= STAGE_CAP

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = stages.findIndex((s) => s.id === active.id)
    const newIdx = stages.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return

    const next = arrayMove(stages, oldIdx, newIdx).map((s, i) => ({ ...s, sort_order: i + 1 }))
    const previous = stages
    setStages(next)

    startTransition(async () => {
      const result = await reorderPipelineStages({
        vacancyId,
        orderedStageIds: next.map((s) => s.id),
      })
      if (!result.success) {
        setStages(previous)
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleAdd = (name: string, type: PipelineStageType) => {
    startTransition(async () => {
      const result = await createPipelineStage({ vacancyId, name, type })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setAddOpen(false)
      toast.success(tr('pipeStages.added', { name }))
      router.refresh()
    })
  }

  const handleSaveName = (stage: PipelineStageRow) => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === stage.name) {
      setEditingId(null)
      return
    }
    const previous = stages
    setStages(stages.map((s) => (s.id === stage.id ? { ...s, name: trimmed } : s)))
    setEditingId(null)
    startTransition(async () => {
      const result = await updatePipelineStage({
        stageId: stage.id,
        vacancyId,
        name: trimmed,
      })
      if (!result.success) {
        setStages(previous)
        toast.error(result.error)
      }
    })
  }

  const handleTypeChange = (stage: PipelineStageRow, type: PipelineStageType) => {
    if (type === stage.type) return
    const previous = stages
    setStages(stages.map((s) => (s.id === stage.id ? { ...s, type } : s)))
    startTransition(async () => {
      const result = await updatePipelineStage({ stageId: stage.id, vacancyId, type })
      if (!result.success) {
        setStages(previous)
        toast.error(result.error)
      }
    })
  }

  const handleDelete = (stage: PipelineStageRow) => {
    if (!window.confirm(tr('pipeStages.deleteConfirm', { name: stage.name }))) {
      return
    }
    const previous = stages
    setStages(stages.filter((s) => s.id !== stage.id))
    startTransition(async () => {
      const result = await deletePipelineStage({ stageId: stage.id, vacancyId })
      if (!result.success) {
        setStages(previous)
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {stages.map((stage) => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                canEdit={canEdit}
                isEditing={editingId === stage.id}
                editName={editName}
                onEditStart={() => {
                  setEditingId(stage.id)
                  setEditName(stage.name)
                }}
                onEditChange={setEditName}
                onEditSave={() => handleSaveName(stage)}
                onEditCancel={() => setEditingId(null)}
                onTypeChange={(t) => handleTypeChange(stage, t)}
                onDelete={() => handleDelete(stage)}
                pending={pending}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={pending || atCap}
            className="h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {tr('pipeStages.addStage')}
          </Button>
          <span className="text-[11.5px] text-muted-foreground">
            {tr('pipeStages.stageCount', { count: stages.length, cap: STAGE_CAP })}
          </span>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        {tr.rich('pipeStages.typeHint', { b: (c) => <strong className="text-foreground">{c}</strong> })}
      </p>

      {addOpen && (
        <AddStageDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={handleAdd}
          pending={pending}
        />
      )}
    </div>
  )
}

interface SortableStageRowProps {
  stage: PipelineStageRow
  canEdit: boolean
  isEditing: boolean
  editName: string
  onEditStart: () => void
  onEditChange: (s: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onTypeChange: (t: PipelineStageType) => void
  onDelete: () => void
  pending: boolean
}

function SortableStageRow({
  stage,
  canEdit,
  isEditing,
  editName,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onTypeChange,
  onDelete,
  pending,
}: SortableStageRowProps) {
  const tr = useTranslations()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })

  const canonicalCode = mapPipelineStageToBucket({
    type: stage.type,
    name: stage.name,
    is_terminal: stage.is_terminal,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 rounded-[9px] border border-[oklch(0.92_0.01_250)] bg-white px-2.5 py-2"
    >
      {canEdit ? (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={tr('pipeStages.dragReorder')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <span className="w-3.5" />
      )}

      <span
        className={cn(
          'rounded-md px-2.5 py-0.5 text-[12px] font-semibold',
          APPLICATION_STATUS_COLORS[canonicalCode],
        )}
      >
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave()
              if (e.key === 'Escape') onEditCancel()
            }}
            autoFocus
            disabled={pending}
            maxLength={60}
            className="h-6 bg-white text-[12px]"
          />
        ) : (
          pipelineStageLabel(tr, stage.name)
        )}
      </span>

      {canEdit ? (
        <TypeSelect
          value={stage.type}
          onChange={onTypeChange}
          disabled={pending || isEditing}
        />
      ) : (
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {tr(TYPE_META[stage.type].labelKey)}
        </span>
      )}

      {stage.is_terminal && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
          {tr('pipeStages.terminal')}
        </span>
      )}

      {canEdit && (
        <div className="ml-auto flex items-center gap-0.5">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600"
                aria-label={tr('pipeStages.saveNameAria')}
                onClick={onEditSave}
                disabled={pending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={tr('pipeStages.cancelEditAria')}
                onClick={onEditCancel}
                disabled={pending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={tr('pipeStages.renameAria')}
                onClick={onEditStart}
                disabled={pending}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label={tr('pipeStages.deleteAria')}
                onClick={onDelete}
                disabled={pending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

interface TypeSelectProps {
  value: PipelineStageType
  onChange: (t: PipelineStageType) => void
  disabled: boolean
}

function TypeSelect({ value, onChange, disabled }: TypeSelectProps) {
  const tr = useTranslations()
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PipelineStageType)}
      disabled={disabled}
      className="h-7 rounded-md border border-[oklch(0.9_0.01_250)] bg-white px-1.5 text-[11.5px] font-semibold text-foreground/80 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.18_250)] disabled:opacity-60"
      aria-label={tr('pipeStages.stageType')}
    >
      {(['standard', 'review', 'interview', 'offer'] as const).map((opt) => (
        <option key={opt} value={opt}>
          {tr(TYPE_META[opt].labelKey)}
        </option>
      ))}
    </select>
  )
}

interface AddStageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, type: PipelineStageType) => void
  pending: boolean
}

function AddStageDialog({ open, onOpenChange, onAdd, pending }: AddStageDialogProps) {
  const tr = useTranslations()
  const [name, setName] = useState('')
  const [type, setType] = useState<PipelineStageType>('interview')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr('pipeStages.addStage')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-name" className="text-[12px] font-medium text-muted-foreground">
              {tr('pipeStages.stageName')}
            </Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('pipeStages.stageNamePlaceholder')}
              maxLength={60}
              disabled={pending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">
              {tr('pipeStages.stageType')}{' '}
              <span className="text-muted-foreground/70">
                {tr('pipeStages.stageTypeHint')}
              </span>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['standard', 'review', 'interview', 'offer'] as const).map((opt) => {
                const meta = TYPE_META[opt]
                const Icon = meta.icon
                const selected = type === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setType(opt)}
                    aria-pressed={selected}
                    disabled={pending}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors',
                      selected
                        ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)]'
                        : 'border border-[oklch(0.9_0.01_250)] hover:bg-muted/40',
                    )}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={
                        selected
                          ? { background: 'oklch(0.93 0.05 250)' }
                          : { background: 'oklch(0.95 0.01 250)' }
                      }
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          selected ? 'text-[oklch(0.45_0.16_250)]' : 'text-muted-foreground',
                        )}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[12.5px] font-bold',
                          selected ? 'text-[oklch(0.2_0.16_250)]' : 'text-foreground',
                        )}
                      >
                        {tr(meta.labelKey)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-[1.4] text-muted-foreground">
                        {tr(meta.descKey)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tr('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onAdd(name, type)}
            disabled={pending || !name.trim()}
            className="bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            {tr('pipeStages.addStage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

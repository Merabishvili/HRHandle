'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  CheckCheck,
  Circle,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Video,
  Wand2,
} from 'lucide-react'
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

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import {
  applyTemplateToEmptyVacancies,
  countEmptyVacancies,
  createOrgPipelineStageTemplate,
  deleteOrgPipelineStageTemplate,
  reorderOrgPipelineStageTemplates,
  seedOrgPipelineStageTemplateFromDefaults,
} from '@/lib/actions/org-pipeline-stage-templates'
import type {
  OrgPipelineStageTemplate,
  PipelineStageType,
} from '@/lib/pipeline-stage-templates/types'

interface Props {
  initialStages: OrgPipelineStageTemplate[]
}

type TypeMeta = {
  key: PipelineStageType
  label: string
  description: string
  icon: React.ElementType
  pillBg: string
  pillText: string
}

const TYPE_META: TypeMeta[] = [
  {
    key: 'standard',
    label: 'Standard',
    description: 'Move & notes only',
    icon: Circle,
    pillBg: 'bg-[oklch(0.93_0.05_250)]',
    pillText: 'text-[oklch(0.42_0.16_250)]',
  },
  {
    key: 'review',
    label: 'Review / Assessment',
    description: 'Scorecard only — no scheduling',
    icon: CheckCheck,
    pillBg: 'bg-[oklch(0.95_0.08_95)]',
    pillText: 'text-[oklch(0.48_0.11_80)]',
  },
  {
    key: 'interview',
    label: 'Interview',
    description: 'Schedule interview · add scorecard · feedback',
    icon: Video,
    pillBg: 'bg-[oklch(0.93_0.06_300)]',
    pillText: 'text-[oklch(0.45_0.15_300)]',
  },
  {
    key: 'offer',
    label: 'Offer',
    description: 'Create & track offer',
    icon: FileText,
    pillBg: 'bg-[oklch(0.94_0.06_200)]',
    pillText: 'text-[oklch(0.42_0.12_210)]',
  },
]

const STANDARD_META = TYPE_META[0]!

const typeMeta = (t: PipelineStageType): TypeMeta =>
  TYPE_META.find((m) => m.key === t) ?? STANDARD_META

/** The built-in default set every new vacancy uses when the org hasn't saved
 * a custom template. Shown read-only in the empty state so the "view" isn't
 * blank, and reused by "Use defaults". */
const DEFAULT_STAGE_PREVIEW: { name: string; type: PipelineStageType; is_terminal: boolean }[] = [
  { name: 'Applied', type: 'standard', is_terminal: false },
  { name: 'Screening', type: 'review', is_terminal: false },
  { name: 'Interview', type: 'interview', is_terminal: false },
  { name: 'Offer', type: 'offer', is_terminal: false },
  { name: 'Hired', type: 'standard', is_terminal: true },
  { name: 'Rejected', type: 'standard', is_terminal: true },
  { name: 'Withdrawn', type: 'standard', is_terminal: true },
]

export function PipelineStagesManager({ initialStages }: Props) {
  const [stages, setStages] = useState<OrgPipelineStageTemplate[]>(initialStages)
  const [addOpen, setAddOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [emptyVacancyCount, setEmptyVacancyCount] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Pre-fetch the empty-vacancy count so the "apply to N vacancies"
  // button always shows the current number.
  useEffect(() => {
    if (stages.length === 0) {
      setEmptyVacancyCount(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await countEmptyVacancies()
      if (!cancelled && res.success) setEmptyVacancyCount(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [stages.length])

  const onAdded = (created: OrgPipelineStageTemplate) => {
    setStages((prev) => [...prev, created])
    setAddOpen(false)
  }

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const result = await deleteOrgPipelineStageTemplate(id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setStages((prev) => prev.filter((s) => s.id !== id))
      toast.success('Stage removed')
    })
  }

  const handleSeedDefaults = () => {
    startTransition(async () => {
      const result = await seedOrgPipelineStageTemplateFromDefaults()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const now = Date.now()
      setStages([
        { id: `tmp-${now}-1`, name: 'Applied',   type: 'standard',  sort_order: 1, is_terminal: false },
        { id: `tmp-${now}-2`, name: 'Screening', type: 'review',    sort_order: 2, is_terminal: false },
        { id: `tmp-${now}-3`, name: 'Interview', type: 'interview', sort_order: 3, is_terminal: false },
        { id: `tmp-${now}-4`, name: 'Offer',     type: 'offer',     sort_order: 4, is_terminal: false },
        { id: `tmp-${now}-5`, name: 'Hired',     type: 'standard',  sort_order: 5, is_terminal: true  },
        { id: `tmp-${now}-6`, name: 'Rejected',  type: 'standard',  sort_order: 6, is_terminal: true  },
        { id: `tmp-${now}-7`, name: 'Withdrawn', type: 'standard',  sort_order: 7, is_terminal: true  },
      ])
      toast.success('Default stages added')
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = stages.findIndex((s) => s.id === active.id)
    const newIdx = stages.findIndex((s) => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const next = arrayMove(stages, oldIdx, newIdx)
    setStages(next) // optimistic
    startTransition(async () => {
      const result = await reorderOrgPipelineStageTemplates(next.map((s) => s.id))
      if (!result.success) {
        toast.error(result.error)
        setStages(stages) // revert
      }
    })
  }

  const handleApplyToEmpty = () => {
    startTransition(async () => {
      const result = await applyTemplateToEmptyVacancies()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const n = result.data.updated
      toast.success(
        n === 0
          ? 'No empty vacancies to update'
          : `Applied template to ${n} vacanc${n === 1 ? 'y' : 'ies'}`,
      )
      setEmptyVacancyCount(0)
      setApplyOpen(false)
    })
  }

  return (
    <div className="space-y-4">
      {stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">Using the built-in default set</p>
          <p className="mt-1 text-xs text-muted-foreground">
            New vacancies start with these stages. Seed them here to customise the set (rename,
            reorder, add up to 10).
          </p>
          {/* Read-only preview so the view always shows the actual stages. */}
          <ul className="mx-auto mt-4 flex max-w-md flex-col gap-1.5 text-left">
            {DEFAULT_STAGE_PREVIEW.map((s) => {
              const meta = typeMeta(s.type)
              return (
                <li
                  key={s.name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2"
                >
                  <span className="text-[13px] font-medium text-foreground">{s.name}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-semibold', meta.pillBg, meta.pillText)}>
                    {meta.label}
                  </span>
                  {s.is_terminal && (
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Terminal
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSeedDefaults}
              disabled={pending}
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              Use defaults
            </Button>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)} disabled={pending}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Add stage
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-4">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {stages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onRemove={handleRemove}
                    disabled={pending}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11.5px] text-muted-foreground">
              {stages.length} of 10 stages · drag to reorder
            </p>
            <div className="flex items-center gap-2">
              {(emptyVacancyCount ?? 0) > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyOpen(true)}
                  disabled={pending}
                  className="gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  Apply to {emptyVacancyCount} empty{' '}
                  {emptyVacancyCount === 1 ? 'vacancy' : 'vacancies'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setAddOpen(true)}
                disabled={pending || stages.length >= 10}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Add stage
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddStageDialog open={addOpen} onOpenChange={setAddOpen} onAdded={onAdded} />

      <AlertDialog open={applyOpen} onOpenChange={(v) => !pending && setApplyOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply template to {emptyVacancyCount ?? 0} empty{' '}
              {emptyVacancyCount === 1 ? 'vacancy' : 'vacancies'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vacancies with <strong>no applications</strong> will have their pipeline stages replaced by this template.
                </p>
                <p className="text-muted-foreground">
                  Vacancies that already have applications (live or archived) are skipped — re-pointing stage IDs on existing applications is risky and not supported here.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleApplyToEmpty()
              }}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Applying…
                </>
              ) : (
                'Apply template'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SortableStageRow({
  stage,
  onRemove,
  disabled,
}: {
  stage: OrgPipelineStageTemplate
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const meta = typeMeta(stage.type)
  const Icon = meta.icon
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
    >
      <button
        type="button"
        aria-label={`Drag ${stage.name}`}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold',
          meta.pillBg,
          meta.pillText,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {stage.name}
      </span>
      <span className="text-xs text-muted-foreground">· {meta.label}</span>
      {stage.is_terminal && (
        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10.5px] font-semibold uppercase text-muted-foreground">
          Terminal
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${stage.name}`}
        onClick={() => onRemove(stage.id)}
        disabled={disabled}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  )
}

function AddStageDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (created: OrgPipelineStageTemplate) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PipelineStageType>('standard')
  const [isTerminal, setIsTerminal] = useState(false)
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setName('')
    setType('standard')
    setIsTerminal(false)
  }

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      const result = await createOrgPipelineStageTemplate({
        name: trimmed,
        type,
        isTerminal,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      onAdded({
        id: result.data.id,
        name: trimmed,
        type,
        sort_order: 0,
        is_terminal: isTerminal,
      })
      reset()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base font-bold">Add stage</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="stage-name" className="text-xs text-muted-foreground">
              Stage name
            </label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Technical interview"
              maxLength={60}
              disabled={pending}
              className="mt-1"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Stage type{' '}
              <span className="text-muted-foreground/70">
                — determines what actions appear on the candidate profile
              </span>
            </p>
            <div className="mt-2 space-y-2" role="radiogroup" aria-label="Stage type">
              {TYPE_META.map((meta) => {
                const Icon = meta.icon
                const active = type === meta.key
                return (
                  <button
                    key={meta.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(meta.key)}
                    disabled={pending}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                        : 'border-border hover:border-foreground/20',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                        meta.pillBg,
                      )}
                    >
                      <Icon className={cn('h-4 w-4', meta.pillText)} aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className={cn('block text-sm font-semibold', active ? 'text-primary' : 'text-foreground')}>
                        {meta.label}
                      </span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isTerminal}
              onChange={(e) => setIsTerminal(e.target.checked)}
              disabled={pending}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span>
              Terminal — candidates in this stage are out of the active pipeline (Hired, Rejected, Withdrawn).
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={pending || !name.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Adding…
              </>
            ) : (
              'Add stage'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

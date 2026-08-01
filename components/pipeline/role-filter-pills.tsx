'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Search, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface RoleOption {
  id: string
  title: string
  /** Number of *active* (non-terminal) applications on this vacancy. */
  activeCount: number
}

interface RoleFilterPillsProps {
  options: RoleOption[]
  /** Selected vacancy IDs. Empty array means "all roles" (no filter). The
   * board/list filter to the *union* of these IDs. */
  value: string[]
  onChange: (next: string[]) => void
  /** Total active applications across all roles — rendered in the "All roles" pill. */
  totalActive: number
  /** Max number of role chips shown inline before the rest collapse behind the
   * "+ N more" popover. Selected roles are always promoted into the visible
   * chips (up to this cap) so an active filter is never fully hidden. */
  maxVisible?: number
}

/**
 * Cross-vacancy pipeline role filter — multi-select chips + searchable
 * overflow popover, per `Role Filter Multiselect.dc.html`.
 *
 * Selection model: **multi-select** (union). Clicking a visible chip toggles
 * it without affecting the others; "All roles" clears every selection. The
 * "+ N more" button opens a searchable checklist of *all* vacancies with a
 * draft that commits on Apply — so any vacancy, visible chip or not, can be
 * selected. When the overflow hides an active selection the button shows a
 * "(K selected)" indicator + dot so the recruiter can tell there's a filter
 * tucked inside it.
 */
export function RoleFilterPills({
  options,
  value,
  onChange,
  totalActive,
  maxVisible = 3,
}: RoleFilterPillsProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Set<string>>(new Set(value))

  const selectedSet = useMemo(() => new Set(value), [value])
  const isAll = value.length === 0

  // Promote selected roles to the front so an active filter is always shown as
  // a removable chip; fill the remaining slots with unselected roles, capped at
  // maxVisible. Everything else falls into the overflow popover.
  const { visibleChips, overflowOptions, overflowSelectedCount } = useMemo(() => {
    const selected = options.filter((o) => selectedSet.has(o.id))
    const unselected = options.filter((o) => !selectedSet.has(o.id))
    const visible = [...selected, ...unselected].slice(0, maxVisible)
    const visibleIds = new Set(visible.map((o) => o.id))
    const overflow = options.filter((o) => !visibleIds.has(o.id))
    return {
      visibleChips: visible,
      overflowOptions: overflow,
      overflowSelectedCount: overflow.filter((o) => selectedSet.has(o.id)).length,
    }
  }, [options, selectedSet, maxVisible])

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const openPopover = (next: boolean) => {
    // Re-seed the draft from the committed value each time the popover opens so
    // it reflects any chip toggles made while it was closed.
    if (next) {
      setDraft(new Set(value))
      setSearch('')
    }
    setOpen(next)
  }

  const toggleDraft = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyDraft = () => {
    onChange(Array.from(draft))
    setOpen(false)
  }

  const filteredOverflowList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.title.toLowerCase().includes(q))
  }, [options, search])

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('pipeline.filter.groupAria')}>
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={isAll}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors',
          isAll
            ? 'border-foreground bg-foreground font-semibold text-background'
            : 'border-border bg-background font-medium text-foreground hover:bg-muted',
        )}
      >
        {t('pipeline.filter.allRoles')}
        <span className={cn('tabular-nums', isAll ? 'text-background/70' : 'text-muted-foreground')}>
          · {totalActive}
        </span>
      </button>

      {visibleChips.map((opt) => {
        const active = selectedSet.has(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors',
              active
                ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.93_0.05_250)] px-[13px] font-semibold text-[oklch(0.25_0.14_250)]'
                : 'border-border bg-background font-medium text-foreground hover:bg-muted',
            )}
          >
            <span className="max-w-[180px] truncate">{opt.title}</span>
            <span
              className={cn(
                'tabular-nums',
                active ? 'text-[oklch(0.4_0.14_250)]' : 'text-muted-foreground',
              )}
            >
              · {opt.activeCount}
            </span>
            {active && <X className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        )
      })}

      {overflowOptions.length > 0 && (
        <Popover open={open} onOpenChange={openPopover}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
                open || overflowSelectedCount > 0
                  ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.93_0.05_250)] px-[13px] text-[oklch(0.25_0.14_250)]'
                  : 'border-dashed border-border bg-background text-muted-foreground hover:bg-muted',
              )}
              aria-label={`${t('pipeline.filter.more', { count: overflowOptions.length })}${overflowSelectedCount > 0 ? `, ${t('common.selectedCount', { count: overflowSelectedCount })}` : ''}`}
            >
              {overflowSelectedCount > 0 && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.55_0.18_250)]"
                  aria-hidden
                />
              )}
              {t('pipeline.filter.more', { count: overflowOptions.length })}
              {overflowSelectedCount > 0 && (
                <span className="font-semibold">({t('common.selectedCount', { count: overflowSelectedCount })})</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3">
            <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('pipeline.filter.searchPlaceholder')}
                aria-label={t('pipeline.filter.searchAria')}
                className="h-auto border-0 p-0 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
              {filteredOverflowList.length === 0 ? (
                <p className="px-1.5 py-4 text-center text-[12.5px] text-muted-foreground">
                  {t('pipeline.filter.noMatch')}
                </p>
              ) : (
                filteredOverflowList.map((opt) => {
                  const checked = draft.has(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleDraft(opt.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-muted',
                        checked && 'bg-muted/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          checked
                            ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.55_0.18_250)] text-white'
                            : 'border-border',
                        )}
                        aria-hidden
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                      <span
                        className={cn(
                          'flex-1 truncate text-[13px]',
                          checked ? 'font-semibold text-foreground' : 'text-foreground',
                        )}
                      >
                        {opt.title}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {opt.activeCount}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
              <span className="flex-1 text-[12.5px] text-muted-foreground">
                {t('common.selectedCount', { count: draft.size })}
              </span>
              <button
                type="button"
                onClick={() => setDraft(new Set())}
                className="rounded-md border border-border px-2.5 py-1 text-[12.5px] font-semibold text-foreground hover:bg-muted"
              >
                {t('common.clear')}
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="rounded-md bg-[oklch(0.55_0.18_250)] px-3 py-1 text-[12.5px] font-semibold text-white hover:opacity-90"
              >
                {t('common.apply')}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

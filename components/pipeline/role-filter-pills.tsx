'use client'

import { cn } from '@/lib/utils'

export interface RoleOption {
  id: string
  title: string
  /** Number of *active* (non-terminal) applications on this vacancy. */
  activeCount: number
}

interface RoleFilterPillsProps {
  options: RoleOption[]
  /** Selected vacancy IDs. Empty array means "all roles" (no filter). */
  value: string[]
  onChange: (next: string[]) => void
  /** Total active applications across all roles — rendered in the "All roles" pill. */
  totalActive: number
  /** Number of roles to show inline before collapsing the rest behind "+ N more".
   * Defaults to 3. The "+ N more" pill currently shows but doesn't expand —
   * Slice 2 will add an overflow popover. */
  maxVisible?: number
}

/**
 * A-1 follow-up — Cross-vacancy pipeline role filter, pill-tab style per
 * `Pipeline Versions.dc.html` §3. Replaces the previous popover dropdown
 * with horizontal pills that show per-role counts up-front so the
 * recruiter can scan workload across roles without opening a menu.
 *
 * Selection model: **single-select** (only one role visible at a time)
 * or "All roles" for no filter. The previous multi-select via dropdown
 * was visually noisier and rarely used.
 */
export function RoleFilterPills({
  options,
  value,
  onChange,
  totalActive,
  maxVisible = 3,
}: RoleFilterPillsProps) {
  const isAll = value.length === 0 || value.length === options.length
  const selectedId = value.length === 1 ? value[0] : null

  const visible = options.slice(0, maxVisible)
  const overflow = options.slice(maxVisible)

  const handleClick = (id: string | null) => {
    if (id === null) {
      onChange([])
      return
    }
    if (selectedId === id) {
      // Tapping the active pill returns to All roles.
      onChange([])
    } else {
      onChange([id])
    }
  }

  const Pill = ({
    label,
    count,
    active,
    onClick,
  }: {
    label: string
    count: number
    active: boolean
    onClick: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
      aria-pressed={active}
    >
      <span className="truncate max-w-[180px]">{label}</span>
      <span
        className={cn(
          'tabular-nums',
          active ? 'text-background/70' : 'text-muted-foreground',
        )}
      >
        · {count}
      </span>
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by role">
      <Pill
        label="All roles"
        count={totalActive}
        active={isAll}
        onClick={() => handleClick(null)}
      />
      {visible.map((opt) => (
        <Pill
          key={opt.id}
          label={opt.title}
          count={opt.activeCount}
          active={selectedId === opt.id}
          onClick={() => handleClick(opt.id)}
        />
      ))}
      {overflow.length > 0 && (
        // Slice 2 will turn this into a popover with the rest of the roles;
        // for now we just show the count so the user knows there's more.
        <span className="inline-flex shrink-0 items-center rounded-full border border-dashed border-border px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground">
          + {overflow.length} more
        </span>
      )}
    </div>
  )
}

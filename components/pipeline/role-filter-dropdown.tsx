'use client'

import { useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface RoleOption {
  id: string
  title: string
  /** Number of *active* (non-terminal) applications on this vacancy — shown
   * to the right of the role name so the recruiter can spot dead roles
   * without leaving the filter. */
  activeCount: number
}

interface RoleFilterDropdownProps {
  options: RoleOption[]
  /** Selected vacancy IDs. Empty array means "all roles" (no filter). */
  value: string[]
  onChange: (next: string[]) => void
}

/**
 * Wave 2.1 cross-vacancy board — role filter dropdown.
 *
 * Single button trigger ("All roles ▼" by default). Click opens a checkbox
 * list of every active vacancy. Multi-select per locked decision —
 * recruiters can show "Sales + Engineering" together without picking one
 * or the other. Empty selection is treated as "all" (no filter).
 *
 * Label rules:
 * - 0 selected (or value.length === options.length) → "All roles"
 * - 1 selected → that role's title
 * - 2+ selected → "N of M roles"
 */
export function RoleFilterDropdown({
  options,
  value,
  onChange,
}: RoleFilterDropdownProps) {
  const [open, setOpen] = useState(false)

  const isAll = value.length === 0 || value.length === options.length
  const selectedSet = new Set(value)

  const label = (() => {
    if (isAll) return 'All roles'
    if (value.length === 1) {
      const only = options.find((o) => o.id === value[0])
      return only?.title ?? '1 role'
    }
    return `${value.length} of ${options.length} roles`
  })()

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const clear = () => {
    onChange([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 text-sm"
          aria-label="Filter by role"
          aria-expanded={open}
        >
          <span className="truncate max-w-[200px]">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filter by role
          </p>
          {!isAll && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          )}
        </div>

        <ul className="max-h-[300px] overflow-y-auto py-1">
          {options.map((option) => {
            const checked = selectedSet.has(option.id)
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                    checked && 'text-foreground',
                    !checked && 'text-foreground/80',
                  )}
                  aria-pressed={checked}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{option.title}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {option.activeCount}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

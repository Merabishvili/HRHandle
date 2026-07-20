'use client'

import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface SearchableSelectOption {
  /** Stable identifier — the value emitted by onValueChange. */
  value: string
  /** Visible label in the trigger and in the dropdown list. */
  label: React.ReactNode
  /**
   * Optional extra text to match against the user's search query, in addition
   * to the label. Useful when the label is just a name but you also want to
   * match by, say, department or location. Defaults to using `label` (string-
   * stringified) when omitted.
   */
  searchText?: string
  /** Optional secondary line shown under the label in the dropdown. */
  description?: React.ReactNode
  disabled?: boolean
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** Forwarded to the trigger button; matches the surrounding <Label htmlFor>. */
  id?: string
  /** Extra classes on the trigger. The trigger is `w-full` by default. */
  triggerClassName?: string
  /** Extra classes on the popover content. */
  contentClassName?: string
  /** Hidden form input name — set when used inside a native <form>. */
  name?: string
  'aria-label'?: string
  'aria-describedby'?: string
}

/**
 * Drop-in replacement for `<Select>` with a built-in search box. Looks the
 * same when closed; once opened, types into a filter input and the option
 * list narrows accordingly. Built on the existing `<Popover>` + `<Command>`
 * primitives (cmdk + radix), so it gets keyboard navigation, focus
 * management, and ARIA semantics for free.
 *
 * Use anywhere the option list could grow large enough to make a plain
 * native select hard to scan (vacancy pickers, candidate pickers, sector,
 * filterable toolbars). For ≤8 fixed options, the regular `<Select>` is
 * still a better fit.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  disabled,
  id,
  triggerClassName,
  contentClassName,
  name,
  ...ariaProps
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  return (
    <>
      {/* Hidden input so the value can be picked up by a native form submit. */}
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}

      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              // Match the visual style of `<SelectTrigger>` so the trigger is
              // a drop-in replacement and forms don't look inconsistent.
              "border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
              'flex w-full h-9 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
              'focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
              triggerClassName,
            )}
            {...ariaProps}
          >
            <span
              className={cn(
                'truncate text-left',
                !selected && 'text-muted-foreground',
              )}
            >
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 opacity-50"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className={cn('p-0', contentClassName)}
          align="start"
          // Match width to the trigger so the popover doesn't visually drift.
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command
            // Custom filter: use option.searchText if provided, else label text.
            // The default cmdk filter only matches against the CommandItem's
            // `value`, which we have to set to something stable like `o.value`.
            filter={(itemValue, search) => {
              const opt = options.find((o) => o.value === itemValue)
              if (!opt) return 0
              const haystack = (
                opt.searchText ?? (typeof opt.label === 'string' ? opt.label : '')
              ).toLowerCase()
              return haystack.includes(search.toLowerCase()) ? 1 : 0
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled ?? false}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue)
                      setOpen(false)
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{option.label}</div>
                      {option.description ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    <Check
                      aria-hidden="true"
                      className={cn(
                        'ml-2 size-4 shrink-0',
                        value === option.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}

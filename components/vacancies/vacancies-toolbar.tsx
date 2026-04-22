'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, Columns3, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { updateColumnPreferences } from '@/lib/actions/preferences'
import {
  OPTIONAL_VACANCY_COLUMNS,
  DEFAULT_VACANCY_COLUMNS,
  VACANCY_SORT_OPTIONS,
  MAX_OPTIONAL_COLUMNS,
} from '@/lib/types/columns'

interface VacanciesToolbarProps {
  initialSearch: string
  initialSort: string
  selectedColumns: string[]
}

export function VacanciesToolbar({
  initialSearch,
  initialSort,
  selectedColumns: initialColumns,
}: VacanciesToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [searchValue, setSearchValue] = useState(initialSearch)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    initialColumns.length > 0 ? initialColumns : DEFAULT_VACANCY_COLUMNS
  )
  const [colPopoverOpen, setColPopoverOpen] = useState(false)
  const [savingCols, setSavingCols] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchValue.trim()) {
        params.set('search', searchValue.trim())
      } else {
        params.delete('search')
      }
      params.delete('page')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  function handleSortChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => {
      if (prev.includes(key)) {
        return prev.filter((c) => c !== key)
      }
      if (prev.length >= MAX_OPTIONAL_COLUMNS) return prev
      return [...prev, key]
    })
  }

  async function saveColumns() {
    setSavingCols(true)
    await updateColumnPreferences('vacancies', selectedColumns)
    setSavingCols(false)
    setColPopoverOpen(false)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vacancies..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={initialSort || 'created_desc'} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[200px]">
          <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {VACANCY_SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={colPopoverOpen} onOpenChange={setColPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Columns
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Select up to {MAX_OPTIONAL_COLUMNS} optional columns
            <span className="ml-1 text-foreground">({selectedColumns.length}/{MAX_OPTIONAL_COLUMNS})</span>
          </p>

          <div className="space-y-1">
            {OPTIONAL_VACANCY_COLUMNS.map((col) => {
              const isSelected = selectedColumns.includes(col.key)
              const isDisabled = !isSelected && selectedColumns.length >= MAX_OPTIONAL_COLUMNS
              return (
                <button
                  key={col.key}
                  onClick={() => !isDisabled && toggleColumn(col.key)}
                  disabled={isDisabled}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer hover:bg-muted'
                  } ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {col.label}
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              )
            })}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Fixed columns (always visible)</p>
            {['Position', 'Status', 'Candidates'].map((label) => (
              <div key={label} className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
                {label}
                <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
            ))}
          </div>

          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={saveColumns}
            disabled={savingCols}
          >
            {savingCols ? 'Saving…' : 'Apply'}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

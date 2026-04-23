'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, Columns3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnManagerDialog } from '@/components/shared/column-manager-dialog'
import { updateColumnPreferences } from '@/lib/actions/preferences'
import {
  OPTIONAL_CANDIDATE_COLUMNS,
  DEFAULT_CANDIDATE_COLUMNS,
  CANDIDATE_SORT_OPTIONS,
} from '@/lib/types/columns'

interface StatusOption {
  id: string
  name: string
}

interface CandidatesToolbarProps {
  initialSearch: string
  initialSort: string
  initialStatus: string
  selectedColumns: string[]
  statusOptions: StatusOption[]
}

const FIXED_COLUMNS = [
  { label: 'Candidate' },
  { label: 'Status' },
  { label: 'Linked Vacancy' },
]

export function CandidatesToolbar({
  initialSearch,
  initialSort,
  initialStatus,
  selectedColumns: initialColumns,
  statusOptions,
}: CandidatesToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [searchValue, setSearchValue] = useState(initialSearch)
  const [colDialogOpen, setColDialogOpen] = useState(false)
  const activeColumns = initialColumns.length > 0 ? initialColumns : DEFAULT_CANDIDATE_COLUMNS

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

  function handleStatusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('status')
    } else {
      params.set('status', value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  async function handleSaveColumns(columns: string[]) {
    await updateColumnPreferences('candidates', columns)
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={initialStatus || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={initialSort || 'created_desc'} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[240px]">
            <SlidersHorizontal className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {CANDIDATE_SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="gap-2 h-10 px-4" onClick={() => setColDialogOpen(true)}>
          <Columns3 className="h-4 w-4" />
          Columns
        </Button>
      </div>

      <ColumnManagerDialog
        open={colDialogOpen}
        onOpenChange={setColDialogOpen}
        allColumns={OPTIONAL_CANDIDATE_COLUMNS}
        fixedColumns={FIXED_COLUMNS}
        selectedColumns={activeColumns}
        onSave={handleSaveColumns}
      />
    </>
  )
}

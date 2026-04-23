'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AppStatusOption {
  id: string
  name: string
  code: string
}

interface VacancyApplicationsToolbarProps {
  initialSearch: string
  initialStatus: string
  appStatuses: AppStatusOption[]
}

export function VacancyApplicationsToolbar({
  initialSearch,
  initialStatus,
  appStatuses,
}: VacancyApplicationsToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(initialSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchValue.trim()) {
        params.set('appSearch', searchValue.trim())
      } else {
        params.delete('appSearch')
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue])

  function handleStatusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('appStatus')
    } else {
      params.set('appStatus', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative min-w-[180px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search candidates..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      <Select value={initialStatus || 'all'} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {appStatuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

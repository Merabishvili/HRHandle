'use client'

import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type AuditLogFilter } from '@/lib/audit-log/filter'

export interface AuditLogFiltersProps {
  filter: AuditLogFilter
  members: { id: string; full_name: string | null; email: string | null }[]
  /** The base path the form submits to. Always `/settings/audit-log` in practice. */
  basePath?: string
}

const USER_NONE = '__none'

export function AuditLogFilters({
  filter,
  members,
  basePath = '/settings/audit-log',
}: AuditLogFiltersProps) {
  const router = useRouter()

  const setParam = (key: keyof AuditLogFilter, value: string | null) => {
    const params = new URLSearchParams()
    if (filter.action) params.set('action', filter.action)
    if (filter.entityType) params.set('entityType', filter.entityType)
    if (filter.userId) params.set('userId', filter.userId)
    if (filter.from) params.set('from', filter.from)
    if (filter.to) params.set('to', filter.to)

    if (value && value !== USER_NONE) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    // Filter change always resets the paginator.
    params.delete('page')

    router.push(`${basePath}?${params.toString()}`)
  }

  const hasAny =
    filter.action || filter.entityType || filter.userId || filter.from || filter.to

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const params = new URLSearchParams()
        const action = data.get('action')?.toString().trim()
        const entityType = data.get('entityType')?.toString().trim()
        const from = data.get('from')?.toString().trim()
        const to = data.get('to')?.toString().trim()
        if (action) params.set('action', action)
        if (entityType) params.set('entityType', entityType)
        if (filter.userId) params.set('userId', filter.userId)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        router.push(`${basePath}?${params.toString()}`)
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="al-action" className="text-xs">Action</Label>
        <Input
          id="al-action"
          name="action"
          defaultValue={filter.action ?? ''}
          placeholder="e.g. status_changed"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="al-entity" className="text-xs">Entity type</Label>
        <Input
          id="al-entity"
          name="entityType"
          defaultValue={filter.entityType ?? ''}
          placeholder="e.g. candidate"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="al-user" className="text-xs">User</Label>
        <Select
          value={filter.userId ?? USER_NONE}
          onValueChange={(v) => setParam('userId', v)}
        >
          <SelectTrigger id="al-user" className="h-9 text-sm">
            <SelectValue placeholder="Any user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={USER_NONE}>Any user</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name || m.email || m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="al-from" className="text-xs">From</Label>
        <Input
          id="al-from"
          name="from"
          type="date"
          defaultValue={filter.from ?? ''}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="al-to" className="text-xs">To</Label>
        <Input
          id="al-to"
          name="to"
          type="date"
          defaultValue={filter.to ?? ''}
          className="h-9 text-sm"
        />
      </div>

      <div className="col-span-full flex items-center gap-2">
        <Button type="submit" size="sm">
          <Search className="mr-2 h-3.5 w-3.5" />
          Apply
        </Button>
        {hasAny && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push(basePath)}
          >
            <X className="mr-2 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </form>
  )
}

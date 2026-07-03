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
const ANY = '__any'

// The loggable entity + action types (from `writeAuditLog` call sites). Sourced
// as dropdowns rather than free text so a typo can't silently return zero rows,
// and so admins can discover what's actually loggable.
const ENTITY_TYPES = [
  'application',
  'candidate',
  'candidate_evaluation',
  'integration',
  'offer',
  'organization',
  'profile',
  'saved_view',
  'vacancy',
  'webhook_notification',
]

const ACTION_TYPES = [
  'ai_assist',
  'application_withdrawn',
  'calendly_connected',
  'calendly_disconnected',
  'calendly_link_generated',
  'candidate_deleted',
  'candidate_hard_deleted',
  'candidate_restored',
  'candidates_imported',
  'connected',
  'deletion_scheduled',
  'disconnected',
  'interview_canceled',
  'interview_scheduled',
  'mfa_admin_reset',
  'mfa_enrolled',
  'mfa_policy_updated',
  'mfa_removed',
  'offer_accepted',
  'offer_created',
  'offer_declined',
  'offer_sent',
  'offer_withdrawn',
  'saved_view_created',
  'saved_view_deleted',
  'saved_view_renamed',
  'saved_view_updated',
  'scorecard_revoked',
  'scorecard_shared',
  'status_change_email_sent',
  'status_changed',
  'vacancy_hard_deleted',
  'vacancy_restored',
  'webhook_notification_created',
  'webhook_notification_deleted',
  'webhook_notification_dispatched',
  'webhook_notification_updated',
]

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
        // action + entityType are controlled Selects (already in the URL via
        // setParam); only the date inputs are form-submitted, so preserve the
        // current filter for the rest.
        const from = data.get('from')?.toString().trim()
        const to = data.get('to')?.toString().trim()
        if (filter.action) params.set('action', filter.action)
        if (filter.entityType) params.set('entityType', filter.entityType)
        if (filter.userId) params.set('userId', filter.userId)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        router.push(`${basePath}?${params.toString()}`)
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="al-action" className="text-xs">Action</Label>
        <Select
          value={filter.action ?? ANY}
          onValueChange={(v) => setParam('action', v === ANY ? null : v)}
        >
          <SelectTrigger id="al-action" className="h-9 text-sm">
            <SelectValue placeholder="Any action" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ANY}>Any action</SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a} value={a} className="font-mono text-xs">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="al-entity" className="text-xs">Entity type</Label>
        <Select
          value={filter.entityType ?? ANY}
          onValueChange={(v) => setParam('entityType', v === ANY ? null : v)}
        >
          <SelectTrigger id="al-entity" className="h-9 text-sm">
            <SelectValue placeholder="Any entity" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ANY}>Any entity</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e} className="font-mono text-xs">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

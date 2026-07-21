import { describe, it, expect } from 'vitest'
import {
  parseAuditLogFilter,
  isFilterActive,
  filterToSearchParams,
} from '@/lib/audit-log/filter'

const UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

describe('parseAuditLogFilter', () => {
  it('trims action/entityType, nulls empties', () => {
    const f = parseAuditLogFilter({ action: '  status_changed ', entityType: '' })
    expect(f.action).toBe('status_changed')
    expect(f.entityType).toBeNull()
  })
  it('accepts a valid UUID user id (lowercased), rejects non-UUID', () => {
    expect(parseAuditLogFilter({ userId: UUID.toUpperCase() }).userId).toBe(UUID)
    expect(parseAuditLogFilter({ userId: 'not-a-uuid' }).userId).toBeNull()
  })
  it('accepts YYYY-MM-DD dates, rejects anything else', () => {
    expect(parseAuditLogFilter({ from: '2026-06-30' }).from).toBe('2026-06-30')
    expect(parseAuditLogFilter({ to: '06/30/2026' }).to).toBeNull()
    expect(parseAuditLogFilter({ from: '2026-06-30T12:00:00Z' }).from).toBeNull()
  })
  it('all-empty params → all null', () => {
    expect(parseAuditLogFilter({})).toEqual({ action: null, entityType: null, userId: null, from: null, to: null })
  })
})

describe('isFilterActive', () => {
  it('is false for an all-null filter', () => {
    expect(isFilterActive(parseAuditLogFilter({}))).toBe(false)
  })
  it('is true when any field is set', () => {
    expect(isFilterActive(parseAuditLogFilter({ action: 'x' }))).toBe(true)
  })
})

describe('filterToSearchParams', () => {
  it('round-trips a populated filter, omitting nulls', () => {
    const f = parseAuditLogFilter({ action: 'a', userId: UUID, from: '2026-01-01' })
    expect(filterToSearchParams(f)).toEqual({ action: 'a', userId: UUID, from: '2026-01-01' })
  })
  it('returns {} for an empty filter', () => {
    expect(filterToSearchParams(parseAuditLogFilter({}))).toEqual({})
  })
})

import { describe, it, expect } from 'vitest'
import {
  parseAuditLogFilter,
  isFilterActive,
  filterToSearchParams,
} from '@/lib/audit-log/filter'

const UUID = '11111111-2222-3333-4444-555555555555'

describe('parseAuditLogFilter', () => {
  it('returns all-null when nothing is provided', () => {
    expect(parseAuditLogFilter({})).toEqual({
      action: null,
      entityType: null,
      userId: null,
      from: null,
      to: null,
    })
  })

  it('trims action + entityType to null on whitespace', () => {
    const f = parseAuditLogFilter({ action: '   ', entityType: '\t\n' })
    expect(f.action).toBeNull()
    expect(f.entityType).toBeNull()
  })

  it('passes normal action / entityType strings through trimmed', () => {
    const f = parseAuditLogFilter({ action: ' ai_assist ', entityType: 'candidate' })
    expect(f.action).toBe('ai_assist')
    expect(f.entityType).toBe('candidate')
  })

  it('accepts a valid YYYY-MM-DD date and rejects everything else', () => {
    expect(parseAuditLogFilter({ from: '2026-07-01' }).from).toBe('2026-07-01')
    expect(parseAuditLogFilter({ from: '2026-7-1' }).from).toBeNull()
    expect(parseAuditLogFilter({ from: '07/01/2026' }).from).toBeNull()
    expect(parseAuditLogFilter({ from: '2026-07-01T00:00:00Z' }).from).toBeNull()
    expect(parseAuditLogFilter({ from: 'yesterday' }).from).toBeNull()
  })

  it('accepts a real UUID for userId and rejects everything else', () => {
    expect(parseAuditLogFilter({ userId: UUID }).userId).toBe(UUID)
    expect(parseAuditLogFilter({ userId: UUID.toUpperCase() }).userId).toBe(UUID)
    expect(parseAuditLogFilter({ userId: 'not-a-uuid' }).userId).toBeNull()
    expect(parseAuditLogFilter({ userId: 'abcd' }).userId).toBeNull()
    expect(parseAuditLogFilter({ userId: '' }).userId).toBeNull()
  })
})

describe('isFilterActive', () => {
  it('false when every field is null', () => {
    expect(
      isFilterActive({
        action: null,
        entityType: null,
        userId: null,
        from: null,
        to: null,
      }),
    ).toBe(false)
  })

  it('true when any single field is set', () => {
    expect(
      isFilterActive({
        action: 'status_changed',
        entityType: null,
        userId: null,
        from: null,
        to: null,
      }),
    ).toBe(true)
    expect(
      isFilterActive({
        action: null,
        entityType: null,
        userId: UUID,
        from: null,
        to: null,
      }),
    ).toBe(true)
    expect(
      isFilterActive({
        action: null,
        entityType: null,
        userId: null,
        from: '2026-07-01',
        to: null,
      }),
    ).toBe(true)
  })
})

describe('filterToSearchParams', () => {
  it('omits null fields entirely', () => {
    expect(
      filterToSearchParams({
        action: 'ai_assist',
        entityType: null,
        userId: null,
        from: null,
        to: null,
      }),
    ).toEqual({ action: 'ai_assist' })
  })

  it('passes all set fields through', () => {
    expect(
      filterToSearchParams({
        action: 'ai_assist',
        entityType: 'candidate',
        userId: UUID,
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ).toEqual({
      action: 'ai_assist',
      entityType: 'candidate',
      userId: UUID,
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })
})

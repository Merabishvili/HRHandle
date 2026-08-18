import { describe, it, expect } from 'vitest'
import { isOrgAdmin } from '@/lib/permissions'

describe('isOrgAdmin', () => {
  it('is true for owner and admin', () => {
    expect(isOrgAdmin('owner')).toBe(true)
    expect(isOrgAdmin('admin')).toBe(true)
  })
  it('is false for member', () => {
    expect(isOrgAdmin('member')).toBe(false)
  })
  it('is false for null / undefined', () => {
    expect(isOrgAdmin(null)).toBe(false)
    expect(isOrgAdmin(undefined)).toBe(false)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
const fromMock = vi.fn(() => ({ insert: insertMock }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}))

import { writeAuditLog } from '@/lib/audit-log'

describe('writeAuditLog', () => {
  beforeEach(() => {
    insertMock.mockReset()
    fromMock.mockClear()
  })

  it('inserts a row into activity_log with snake_case columns', async () => {
    insertMock.mockResolvedValue({ error: null })
    await writeAuditLog({
      orgId: 'org-1',
      userId: 'user-1',
      entityType: 'vacancy',
      entityId: 'vac-1',
      action: 'status_changed',
      message: 'opened',
      details: { before: 'draft', after: 'open' },
    })
    expect(fromMock).toHaveBeenCalledWith('activity_log')
    expect(insertMock).toHaveBeenCalledWith({
      organization_id: 'org-1',
      user_id: 'user-1',
      entity_type: 'vacancy',
      entity_id: 'vac-1',
      action: 'status_changed',
      message: 'opened',
      details: { before: 'draft', after: 'open' },
    })
  })

  it('omitted optional fields are persisted as null', async () => {
    insertMock.mockResolvedValue({ error: null })
    await writeAuditLog({
      orgId: 'org-1',
      userId: null,
      entityType: 'integration',
      entityId: null,
      action: 'disconnected',
    })
    const row = insertMock.mock.calls[0][0]
    expect(row.message).toBeNull()
    expect(row.details).toBeNull()
    expect(row.user_id).toBeNull()
    expect(row.entity_id).toBeNull()
  })

  it('swallows DB errors so the calling action is not affected', async () => {
    insertMock.mockResolvedValue({ error: { message: 'permission denied' } })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      writeAuditLog({
        orgId: 'org-1',
        userId: 'user-1',
        entityType: 'vacancy',
        entityId: 'vac-1',
        action: 'status_changed',
      }),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('swallows unexpected exceptions thrown by the client', async () => {
    insertMock.mockImplementation(() => {
      throw new Error('connection refused')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      writeAuditLog({
        orgId: 'org-1',
        userId: 'user-1',
        entityType: 'vacancy',
        entityId: 'vac-1',
        action: 'status_changed',
      }),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

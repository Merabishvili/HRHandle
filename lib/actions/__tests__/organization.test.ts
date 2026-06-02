import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks for the Supabase clients + redirect.
const { getUserMock, signOutMock, adminFromMock, perTableResponses, redirectMock, writeAuditMock } =
  vi.hoisted(() => {
    const getUserMock = vi.fn()
    const signOutMock = vi.fn().mockResolvedValue({ error: null })
    const writeAuditMock = vi.fn()
    const perTableResponses = new Map<
      string,
      { data: unknown; error: { message: string } | null }
    >()

    function makeChain(table: string) {
      let isUpdate = false
      let isSelectOnly = false
      let updatePayload: Record<string, unknown> | null = null
      let chainedIs = false
      let eqId: string | null = null

      const result = () => {
        const key = isUpdate ? `${table}:update` : `${table}:select`
        return Promise.resolve(perTableResponses.get(key) ?? { data: null, error: null })
      }

      const chain: Record<string, unknown> = {
        select: (_cols?: string) => {
          isSelectOnly = true
          return chain
        },
        update: (payload: Record<string, unknown>) => {
          isUpdate = true
          updatePayload = payload
          return chain
        },
        eq: (col: string, val: string) => {
          if (col === 'id') eqId = val
          if (isSelectOnly) {
            return {
              single: () => result(),
              maybeSingle: () => result(),
            }
          }
          if (isUpdate && !chainedIs) {
            // .update().eq() — wait for chainable .is() before resolving
            return {
              is: (_c: string, _v: unknown) => {
                chainedIs = true
                return result()
              },
              // also resolvable directly if no .is() follows
              then: (resolve: (v: unknown) => unknown) => result().then(resolve),
            }
          }
          return result()
        },
        is: (_col: string, _val: unknown) => result(),
        single: () => result(),
        maybeSingle: () => result(),
        then: (resolve: (v: unknown) => unknown) => result().then(resolve),
      }

      // Expose for assertions
      ;(chain as { __updatePayload?: unknown }).__updatePayload = () => updatePayload
      ;(chain as { __eqId?: () => string | null }).__eqId = () => eqId

      return chain
    }

    const adminFromMock = vi.fn((table: string) => makeChain(table))
    const redirectMock = vi.fn((path: string) => {
      // Mirror next/navigation.redirect's "throw to abort the action" behaviour
      // so the calling code's control flow matches production.
      const err = new Error(`NEXT_REDIRECT:${path}`)
      ;(err as Error & { digest: string }).digest = `NEXT_REDIRECT;${path}`
      throw err
    })

    return {
      getUserMock,
      signOutMock,
      adminFromMock,
      perTableResponses,
      redirectMock,
      writeAuditMock,
    }
  })

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFromMock,
  }),
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditMock,
}))

import { deleteOrganization } from '@/lib/actions/organization'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const ORG_ID = '11111111-1111-1111-1111-111111111111'

function setOwnerOrgState(orgName: string, deletedAt: string | null = null) {
  perTableResponses.set('profiles:select', {
    data: { organization_id: ORG_ID, role: 'owner' },
    error: null,
  })
  perTableResponses.set('organizations:select', {
    data: { id: ORG_ID, name: orgName, deleted_at: deletedAt },
    error: null,
  })
  perTableResponses.set('organizations:update', { data: null, error: null })
}

describe('deleteOrganization', () => {
  beforeEach(() => {
    perTableResponses.clear()
    getUserMock.mockReset()
    signOutMock.mockClear()
    adminFromMock.mockClear()
    redirectMock.mockClear()
    writeAuditMock.mockClear()
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } })
  })

  it('rejects empty confirm name', async () => {
    setOwnerOrgState('Acme Recruiting')
    const result = await deleteOrganization({ confirmName: '   ' })
    expect(result).toEqual({ success: false, error: expect.stringMatching(/type the organization name/i) })
  })

  it('rejects when the user is not authenticated', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const result = await deleteOrganization({ confirmName: 'Acme' })
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('rejects when the user has no organization', async () => {
    perTableResponses.set('profiles:select', {
      data: { organization_id: null, role: 'owner' },
      error: null,
    })
    const result = await deleteOrganization({ confirmName: 'Acme' })
    expect(result).toEqual({ success: false, error: 'No organization to delete' })
  })

  it('rejects when the user is not the owner', async () => {
    perTableResponses.set('profiles:select', {
      data: { organization_id: ORG_ID, role: 'admin' },
      error: null,
    })
    perTableResponses.set('organizations:select', {
      data: { id: ORG_ID, name: 'Acme', deleted_at: null },
      error: null,
    })
    const result = await deleteOrganization({ confirmName: 'Acme' })
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/Only the organization owner/i),
    })
  })

  it('rejects when the typed name does not match the org name', async () => {
    setOwnerOrgState('Acme Recruiting')
    const result = await deleteOrganization({ confirmName: 'WrongCo' })
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/does not match/i),
    })
  })

  it('schedules deletion (owner + matching name), signs out, redirects', async () => {
    setOwnerOrgState('Acme Recruiting')
    await expect(
      deleteOrganization({ confirmName: 'Acme Recruiting' }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/onboarding\/account-deletion-scheduled/)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(writeAuditMock).toHaveBeenCalledTimes(1)
    const auditCall = writeAuditMock.mock.calls[0][0]
    expect(auditCall.entityType).toBe('organization')
    expect(auditCall.action).toBe('deletion_scheduled')
  })

  it('idempotent when the org is already scheduled for deletion', async () => {
    setOwnerOrgState('Acme Recruiting', new Date().toISOString())
    await expect(
      deleteOrganization({ confirmName: 'Acme Recruiting' }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/onboarding\/account-deletion-scheduled/)
    expect(signOutMock).toHaveBeenCalledTimes(1)
    // No audit log on the no-op path — nothing changed.
    expect(writeAuditMock).not.toHaveBeenCalled()
  })

  it('matches name case-insensitively with trimmed whitespace', async () => {
    setOwnerOrgState('Acme Recruiting')
    await expect(
      deleteOrganization({ confirmName: '  ACME RECRUITING  ' }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/onboarding\/account-deletion-scheduled/)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })
})

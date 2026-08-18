import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Build a chainable mock that captures which table.delete().lt().select()
// chains run and what they should return. Each call to `from(table)` returns
// a fresh chain so we can inspect them per-table.
const { fromMock, storageRemoveMock, authAdminDeleteUserMock, perTableResponses } = vi.hoisted(() => {
  const perTableResponses = new Map<string, { data: unknown; error: { message: string } | null }>()

  const storageRemoveMock = vi.fn().mockResolvedValue({ data: [], error: null })
  const authAdminDeleteUserMock = vi.fn().mockResolvedValue({ data: null, error: null })

  function makeQuery(table: string) {
    // Each chain remembers its mode (select|delete|select-after-delete) and
    // when terminated returns the response we've configured for that table.
    let isDelete = false
    let isSelectOnly = false
    let didChainSelect = false
    let eqId: string | null = null

    const result = () => {
      const key = isSelectOnly
        ? `${table}:select`
        : `${table}:delete`
      const eqKey = eqId ? `${table}:delete-eq:${eqId}` : null
      const resp =
        (eqKey && perTableResponses.get(eqKey)) ||
        perTableResponses.get(key) ||
        { data: [], error: null }
      return Promise.resolve(resp)
    }

    const chain: Record<string, unknown> = {
      select: (_cols?: string) => {
        if (isDelete) {
          didChainSelect = true
          return result()
        }
        isSelectOnly = true
        return chain
      },
      delete: () => {
        isDelete = true
        return chain
      },
      lt: (_col: string, _val: string) => chain,
      in: (_col: string, _vals: string[]) => chain,
      eq: (col: string, val: string) => {
        if (col === 'id') eqId = val
        return result()
      },
      // Terminal: if no .select() or .eq() at the end, return on await
      then: (resolve: (v: unknown) => unknown) => {
        if (isDelete && !didChainSelect && !eqId) return result().then(resolve)
        if (isSelectOnly) return result().then(resolve)
        return result().then(resolve)
      },
    }

    return chain
  }

  const fromMock = vi.fn((table: string) => makeQuery(table))

  return { fromMock, storageRemoveMock, authAdminDeleteUserMock, perTableResponses }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: fromMock,
    storage: {
      from: () => ({ remove: storageRemoveMock }),
    },
    auth: {
      admin: {
        deleteUser: authAdminDeleteUserMock,
      },
    },
  }),
}))

import { GET } from '@/app/api/cron/purge-deleted/route'

const SECRET = 'test-cron-secret-1234567890'
const ORIGINAL_SECRET = process.env.CRON_SECRET

function makeReq(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader !== undefined) headers.set('authorization', authHeader)
  return new NextRequest('http://localhost/api/cron/purge-deleted', { headers })
}

describe('GET /api/cron/purge-deleted', () => {
  beforeEach(() => {
    fromMock.mockClear()
    storageRemoveMock.mockClear()
    authAdminDeleteUserMock.mockClear()
    authAdminDeleteUserMock.mockResolvedValue({ data: null, error: null })
    perTableResponses.clear()
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the Bearer token is wrong', async () => {
    const res = await GET(makeReq('Bearer wrong-secret-of-same-length-1'))
    expect(res.status).toBe(401)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns 401 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(401)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns 200 + zero counts when there is nothing to purge', async () => {
    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.candidates_purged).toBe(0)
    expect(body.orphan_applications).toBe(0)
    expect(body.vacancies_purged).toBe(0)
    expect(body.storage_files_deleted).toBe(0)
    expect(storageRemoveMock).not.toHaveBeenCalled()
  })

  it('reports counts of rows actually deleted', async () => {
    // Two candidates to purge; one orphan application; nothing else.
    perTableResponses.set('candidates:select', {
      data: [{ id: 'cand-1' }, { id: 'cand-2' }],
      error: null,
    })
    perTableResponses.set('candidates:delete', {
      data: [{ id: 'cand-1' }, { id: 'cand-2' }],
      error: null,
    })
    perTableResponses.set('applications:delete', { data: [{ id: 'app-1' }], error: null })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.candidates_purged).toBe(2)
    expect(body.orphan_applications).toBe(1)
    expect(body.orphan_documents).toBe(0)
  })

  it('calls storage.remove with the union of direct + cascade doc paths', async () => {
    // Direct soft-deleted doc:
    perTableResponses.set('candidate_documents:select', {
      data: [{ file_path: 'org-x/cv-direct.pdf' }],
      error: null,
    })
    // Two candidates past threshold, each with one doc:
    perTableResponses.set('candidates:select', {
      data: [{ id: 'cand-a' }, { id: 'cand-b' }],
      error: null,
    })
    perTableResponses.set('candidates:delete', {
      data: [{ id: 'cand-a' }, { id: 'cand-b' }],
      error: null,
    })

    // The route's second candidate_documents query (.select on cascade docs)
    // overwrites the same per-table key — so simulate that response too. In
    // practice the chain mock returns the same `candidate_documents:select`
    // value for both calls; we layer cascade docs onto the direct one.
    perTableResponses.set('candidate_documents:select', {
      data: [
        { file_path: 'org-x/cv-direct.pdf' },
        { file_path: 'org-x/cv-cascade-a.pdf' },
        { file_path: 'org-x/cv-cascade-b.pdf' },
      ],
      error: null,
    })

    storageRemoveMock.mockResolvedValueOnce({
      data: [
        { name: 'org-x/cv-direct.pdf' },
        { name: 'org-x/cv-cascade-a.pdf' },
        { name: 'org-x/cv-cascade-b.pdf' },
      ],
      error: null,
    })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    const calledPaths = storageRemoveMock.mock.calls[0]![0] as string[]
    expect(calledPaths).toContain('org-x/cv-direct.pdf')
    expect(calledPaths).toContain('org-x/cv-cascade-a.pdf')
    expect(calledPaths).toContain('org-x/cv-cascade-b.pdf')
  })

  it('still returns ok:true when storage.remove fails (best-effort)', async () => {
    perTableResponses.set('candidate_documents:select', {
      data: [{ file_path: 'org-x/cv.pdf' }],
      error: null,
    })
    storageRemoveMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'storage exploded' },
    })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.storage_errors).toBeGreaterThan(0)
  })

  it('purges organizations past threshold, collects file paths, and deletes auth.users for members (G-007)', async () => {
    // One org soft-deleted past the threshold.
    perTableResponses.set('organizations:select', {
      data: [{ id: 'org-1' }],
      error: null,
    })
    perTableResponses.set('organizations:delete-eq:org-1', {
      data: null,
      error: null,
    })
    // The org has docs in storage…
    perTableResponses.set('candidate_documents:select', {
      data: [{ file_path: 'org-1/cv1.pdf' }, { file_path: 'org-1/cv2.pdf' }],
      error: null,
    })
    // …and two member profiles whose auth.users must also be wiped.
    perTableResponses.set('profiles:select', {
      data: [{ id: 'user-owner' }, { id: 'user-member' }],
      error: null,
    })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.organizations_purged).toBe(1)
    expect(body.auth_users_deleted).toBe(2)
    expect(body.auth_users_delete_errors).toBe(0)

    // auth.admin.deleteUser called once per member.
    expect(authAdminDeleteUserMock).toHaveBeenCalledTimes(2)
    const calledIds = authAdminDeleteUserMock.mock.calls.map((c) => c[0])
    expect(calledIds).toContain('user-owner')
    expect(calledIds).toContain('user-member')

    // Storage cleanup picked up the org's docs.
    expect(storageRemoveMock).toHaveBeenCalledTimes(1)
    const calledPaths = storageRemoveMock.mock.calls[0]![0] as string[]
    expect(calledPaths).toContain('org-1/cv1.pdf')
    expect(calledPaths).toContain('org-1/cv2.pdf')
  })

  it('counts auth.admin.deleteUser errors but still returns ok:true', async () => {
    perTableResponses.set('organizations:select', { data: [{ id: 'org-x' }], error: null })
    perTableResponses.set('organizations:delete-eq:org-x', { data: null, error: null })
    perTableResponses.set('profiles:select', { data: [{ id: 'user-a' }], error: null })

    // First call fails, but the run continues anyway.
    authAdminDeleteUserMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'auth.users delete kaboom' },
    })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.organizations_purged).toBe(1)
    expect(body.auth_users_delete_errors).toBe(1)
    expect(body.auth_users_deleted).toBe(0)
  })

  it('counts vacancies skipped due to RESTRICT, does not abort the run', async () => {
    perTableResponses.set('vacancies:select', {
      data: [{ id: 'vac-blocked' }, { id: 'vac-ok' }],
      error: null,
    })
    // First per-id delete fails (RESTRICT), second succeeds.
    perTableResponses.set('vacancies:delete-eq:vac-blocked', {
      data: null,
      error: { message: 'update or delete on table "vacancies" violates foreign key constraint' },
    })
    perTableResponses.set('vacancies:delete-eq:vac-ok', { data: [{ id: 'vac-ok' }], error: null })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.vacancies_purged).toBe(1)
    expect(body.vacancies_skipped_due_to_restrict).toBe(1)
  })
})

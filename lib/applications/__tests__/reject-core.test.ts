import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── A tiny fake of the Supabase query builder ──────────────────────────────
// Every query is recorded ({table, op, payload, filters}); awaiting it asks
// `respond` for the result, so each test decides what the "database" returns.
type Query = { table: string; op: 'select' | 'update'; payload?: unknown; filters: [string, string, unknown][] }
const { queries, respond, adminQueries } = vi.hoisted(() => ({
  queries: [] as Query[],
  adminQueries: [] as Query[],
  respond: { fn: (_q: Query): { data: unknown; error: unknown } => ({ data: null, error: null }) },
}))

function fakeClient(log: Query[]): SupabaseClient {
  return {
    from(table: string) {
      const q: Query = { table, op: 'select', filters: [] }
      log.push(q)
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (payload: unknown) => ((q.op = 'update'), (q.payload = payload), chain),
        in: (col: string, val: unknown) => (q.filters.push(['in', col, val]), chain),
        eq: (col: string, val: unknown) => (q.filters.push(['eq', col, val]), chain),
        is: (col: string, val: unknown) => (q.filters.push(['is', col, val]), chain),
        gte: (col: string, val: unknown) => (q.filters.push(['gte', col, val]), chain),
        order: () => chain,
        single: () => Promise.resolve(respond.fn(q)),
        maybeSingle: () => Promise.resolve(respond.fn(q)),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(respond.fn(q)).then(resolve),
      }
      return chain
    },
  } as unknown as SupabaseClient
}

const mocks = vi.hoisted(() => ({
  writeAuditLogs: vi.fn(async () => {}),
  sendEmails: vi.fn(async (list: unknown[]) => ({ sent: list.length, failed: 0 })),
  dispatch: vi.fn(async () => {}),
  cancelInterview: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeClient(adminQueries) }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLogs: mocks.writeAuditLogs }))
vi.mock('@/lib/email', () => ({ sendApplicationRejectionEmails: mocks.sendEmails }))
vi.mock('@/lib/i18n/org-locale', () => ({ fetchOrgContentLocale: async () => 'ka' }))
vi.mock('@/lib/notifications/webhook-dispatcher', () => ({ dispatchWebhookNotification: mocks.dispatch }))
vi.mock('@/lib/actions/interviews', () => ({ updateInterviewStatus: mocks.cancelInterview }))
vi.mock('@/lib/pipeline-stages/resolve', () => ({ resolvePipelineStageId: async (_c: unknown, vacancyId: string) => `rejected-stage-${vacancyId}` }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { rejectApplicationsCore } from '@/lib/applications/reject-core'

const ctx = () => ({ supabase: fakeClient(queries), userId: 'user-1', orgId: 'org-1' })
const stage = (type: string, name: string, is_terminal = false) => ({ type, name, is_terminal })

const APPS = [
  { id: 'a1', candidate_id: 'c1', vacancy_id: 'v1', pipeline_stages: stage('standard', 'Applied') },
  { id: 'a2', candidate_id: 'c2', vacancy_id: 'v1', pipeline_stages: stage('interview', 'Interview') },
]

function database(overrides: Partial<Record<string, unknown>> = {}) {
  respond.fn = (q) => {
    const key = `${q.table}:${q.op}`
    if (key in overrides) return { data: overrides[key], error: null }
    switch (key) {
      case 'applications:select':
        return { data: APPS, error: null }
      case 'application_statuses:select':
        return { data: { code: 'rejected' }, error: null }
      case 'applications:update': {
        const ids = q.filters.find((f) => f[0] === 'in')![2] as string[]
        return { data: ids.map((id) => ({ id })), error: null }
      }
      case 'candidate_statuses:select':
        return { data: [{ id: 's-hired', code: 'hired' }, { id: 's-active', code: 'active' }], error: null }
      case 'candidates:select':
        return {
          data: [
            { id: 'c1', first_name: 'Ana', last_name: 'B', email: 'ana@x.ge' },
            { id: 'c2', first_name: 'Gio', last_name: 'K', email: null },
          ],
          error: null,
        }
      case 'vacancies:select':
        return { data: [{ id: 'v1', title: 'Engineer' }], error: null }
      case 'interviews:select':
        return { data: [{ id: 'i1' }], error: null }
      case 'organizations:select':
        return { data: { name: 'Acme' }, error: null }
      case 'profiles:select':
        return { data: { full_name: 'Emily', email: 'emily@acme.ge' }, error: null }
      default:
        return { data: [], error: null }
    }
  }
}

beforeEach(() => {
  queries.length = 0
  adminQueries.length = 0
  for (const m of Object.values(mocks)) m.mockClear()
})

const base = {
  applicationIds: ['a1', 'a2'],
  statusId: 'status-rejected',
  rejectionReasonId: 'reason-1',
  templateId: null,
  sendEmail: true,
  channelMessages: 'summary' as const,
}

describe('rejectApplicationsCore', () => {
  it("moves a vacancy's applications to its Rejected stage in one update, with the reason", async () => {
    database()
    const outcome = await rejectApplicationsCore(ctx(), base)
    const updates = queries.filter((q) => q.table === 'applications' && q.op === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0]!.payload).toMatchObject({ pipeline_stage_id: 'rejected-stage-v1', rejection_reason_id: 'reason-1' })
    expect(outcome.rejected).toEqual(['a1', 'a2'])
    expect(outcome.failed).toEqual([])
  })

  it('logs each stage change for the audit log and the activity feed', async () => {
    database()
    await rejectApplicationsCore(ctx(), base)
    const rows = (mocks.writeAuditLogs.mock.calls[0] as unknown as [{ action: string; entityId: string; details: { before: string; after: string } }[]])[0]
    expect(rows.map((r) => [r.action, r.entityId, r.details.before, r.details.after])).toEqual([
      ['status_changed', 'a1', 'applied', 'rejected'],
      ['status_changed', 'a2', 'interview', 'rejected'],
    ])
  })

  it('withdraws only sent offers, and cancels only upcoming scheduled interviews', async () => {
    database()
    await rejectApplicationsCore(ctx(), base)
    const offerUpdate = adminQueries.find((q) => q.table === 'offers' && q.op === 'update')!
    expect(offerUpdate.payload).toMatchObject({ status: 'withdrawn' })
    expect(offerUpdate.filters).toContainEqual(['eq', 'status', 'sent'])
    const interviewQuery = queries.find((q) => q.table === 'interviews')!
    expect(interviewQuery.filters).toContainEqual(['eq', 'status', 'scheduled'])
    expect(interviewQuery.filters.some((f) => f[0] === 'gte' && f[1] === 'scheduled_at')).toBe(true)
    expect(mocks.cancelInterview).toHaveBeenCalledWith('i1', 'cancelled')
  })

  it('emails everyone with an address in one batch, in the organization language', async () => {
    database()
    const outcome = await rejectApplicationsCore(ctx(), base)
    const emails = (mocks.sendEmails.mock.calls[0] as unknown as [{ to: string; vacancyTitle: string; contentLocale: string }[]])[0]
    expect(emails).toEqual([expect.objectContaining({ to: 'ana@x.ge', vacancyTitle: 'Engineer', contentLocale: 'ka' })])
    expect(outcome.emailsSent).toBe(1)
    expect(outcome.withoutEmail).toBe(1)
  })

  it('sends no email when the switch is off', async () => {
    database()
    await rejectApplicationsCore(ctx(), { ...base, sendEmail: false })
    expect(mocks.sendEmails).not.toHaveBeenCalled()
  })

  it('posts one Slack/Teams summary for a batch, and one message per candidate for a single rejection', async () => {
    database()
    await rejectApplicationsCore(ctx(), base)
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
    expect((mocks.dispatch.mock.calls[0] as unknown[])[2]).toMatchObject({ title: '2 candidates rejected' })

    mocks.dispatch.mockClear()
    database({ 'applications:select': [APPS[0]] })
    await rejectApplicationsCore(ctx(), { ...base, applicationIds: ['a1'], channelMessages: 'each' })
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
    expect((mocks.dispatch.mock.calls[0] as unknown[])[2]).toMatchObject({ title: 'Candidate rejected' })
  })

  it('reports applications it could not find', async () => {
    database({ 'applications:select': [APPS[0]] })
    const outcome = await rejectApplicationsCore(ctx(), base)
    expect(outcome.rejected).toEqual(['a1'])
    expect(outcome.failed).toEqual([{ id: 'a2', error: 'Application not found' }])
  })
})

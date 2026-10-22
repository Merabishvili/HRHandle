import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isResidencyLocked, PAID_ORDER_STATUSES } from '@/lib/billing/residency'

/** A fake client whose payment_orders count query answers `result`. */
function fakeClient(result: { count: number | null; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const chain = {
    select: (...args: unknown[]) => (calls.push({ method: 'select', args }), chain),
    eq: (...args: unknown[]) => (calls.push({ method: 'eq', args }), chain),
    in: (...args: unknown[]) => (calls.push({ method: 'in', args }), Promise.resolve(result)),
  }
  const from = vi.fn(() => chain)
  return { client: { from } as unknown as SupabaseClient, from, calls }
}

describe('isResidencyLocked', () => {
  it('is unlocked before any successful payment', async () => {
    const { client } = fakeClient({ count: 0, error: null })
    expect(await isResidencyLocked(client, 'org-1')).toBe(false)
  })

  it('locks after a paid order, including a refunded one', async () => {
    const { client, from, calls } = fakeClient({ count: 1, error: null })
    expect(await isResidencyLocked(client, 'org-1')).toBe(true)
    expect(from).toHaveBeenCalledWith('payment_orders')
    expect(calls).toContainEqual({ method: 'eq', args: ['organization_id', 'org-1'] })
    expect(calls).toContainEqual({ method: 'in', args: ['status', [...PAID_ORDER_STATUSES]] })
    expect(PAID_ORDER_STATUSES).toContain('reversed')
  })

  it('fails closed when the read errors', async () => {
    const { client } = fakeClient({ count: null, error: { message: 'boom' } })
    expect(await isResidencyLocked(client, 'org-1')).toBe(true)
  })
})

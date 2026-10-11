import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cancelBookedInterview } from '@/lib/calendly/bookings'

/** A fake service-role client that records the update chain and answers it. */
function fakeAdmin(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const chain = {
    update: (...args: unknown[]) => (calls.push({ method: 'update', args }), chain),
    eq: (...args: unknown[]) => (calls.push({ method: 'eq', args }), chain),
    select: (...args: unknown[]) => (calls.push({ method: 'select', args }), Promise.resolve(result)),
  }
  const from = vi.fn(() => chain)
  return { client: { from } as unknown as SupabaseClient, from, calls }
}

describe('cancelBookedInterview', () => {
  it('cancels the scheduled interview booked for that application and start time', async () => {
    const { client, from, calls } = fakeAdmin({ data: [{ id: 'i1' }], error: null })
    const n = await cancelBookedInterview(client, 'app-1', '2026-10-20T10:00:00.000000Z')
    expect(n).toBe(1)
    expect(from).toHaveBeenCalledWith('interviews')
    expect(calls[0]).toMatchObject({ method: 'update', args: [expect.objectContaining({ status: 'cancelled' })] })
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['application_id', 'app-1'],
      ['scheduled_at', '2026-10-20T10:00:00.000000Z'],
      ['status', 'scheduled'],
    ])
  })

  it('does nothing without a start time', async () => {
    const { client, from } = fakeAdmin({ data: [], error: null })
    expect(await cancelBookedInterview(client, 'app-1', undefined)).toBe(0)
    expect(from).not.toHaveBeenCalled()
  })

  it('reports 0 when nothing matched or the update failed', async () => {
    expect(await cancelBookedInterview(fakeAdmin({ data: [], error: null }).client, 'a', 't')).toBe(0)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await cancelBookedInterview(fakeAdmin({ data: null, error: { message: 'boom' } }).client, 'a', 't')).toBe(0)
    err.mockRestore()
  })
})

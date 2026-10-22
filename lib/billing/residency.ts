import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Payment-order statuses that mean money was taken at least once. `reversed`
 * counts too: a refunded order was paid first, and the declaration it was paid
 * under stays fixed.
 */
export const PAID_ORDER_STATUSES = ['approved', 'reversed'] as const

/**
 * The Georgian-residency answer (`organizations.billing_ge_resident`) can be
 * changed by the org only until its first successful payment; after that only
 * support changes it, so the answer given at payment time stays on record.
 * Org members can read their own `payment_orders` (RLS), so the user client
 * works here. A failed read counts as locked (fail closed).
 */
export async function isResidencyLocked(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', [...PAID_ORDER_STATUSES])
  if (error) return true
  return (count ?? 0) > 0
}

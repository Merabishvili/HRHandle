import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The org's payments for the billing page and the receipt page. The payer and
 * card columns aren't granted to signed-in users (members could read them
 * through the role-less RLS policy), so this reads with the service role:
 * callers MUST have checked that the viewer is an owner/admin of `orgId`, and
 * pass the org id from the viewer's own profile. Falls back to the original
 * columns when migration 20261023_payment_records.sql isn't applied yet.
 */
export interface PaymentRecord {
  id: string
  order_id: string
  organization_id: string | null
  plan_code: string
  billing_cycle: string
  currency: string
  amount_minor: number
  status: string
  flitt_payment_id: string | null
  created_at: string
  org_name?: string | null
  billing_country?: string | null
  payer_email?: string | null
  paid_at?: string | null
  masked_card?: string | null
  card_type?: string | null
  rrn?: string | null
  approval_code?: string | null
  reversal_amount_minor?: number | null
  reversed_at?: string | null
}

const BASE = 'id, order_id, organization_id, plan_code, billing_cycle, currency, amount_minor, status, flitt_payment_id, created_at'
const FULL = `${BASE}, org_name, billing_country, payer_email, paid_at, masked_card, card_type, rrn, approval_code, reversal_amount_minor, reversed_at`

const LISTED_STATUSES = ['approved', 'reversed', 'declined', 'expired']

export async function listPayments(orgId: string, limit = 24): Promise<PaymentRecord[]> {
  const supabase = createAdminClient()
  for (const cols of [FULL, BASE]) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select(cols)
      .eq('organization_id', orgId)
      .in('status', LISTED_STATUSES)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (!error) return (data ?? []) as unknown as PaymentRecord[]
  }
  return []
}

export async function getPayment(orgId: string, id: string): Promise<PaymentRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = createAdminClient()
  for (const cols of [FULL, BASE]) {
    const { data, error } = await supabase
      .from('payment_orders')
      .select(cols)
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle()
    if (!error) return (data as unknown as PaymentRecord | null) ?? null
  }
  return null
}

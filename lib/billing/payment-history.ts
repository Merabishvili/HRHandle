import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The org's payments for the billing page and the receipt page, read with the
 * user's client (RLS: own org only; column grants hide the card token and the
 * consent IP). Falls back to the original columns when migration
 * 20261023_payment_records.sql isn't applied yet, so the page still renders.
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

export async function listPayments(
  supabase: SupabaseClient,
  orgId: string,
  limit = 24,
): Promise<PaymentRecord[]> {
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

export async function getPayment(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<PaymentRecord | null> {
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

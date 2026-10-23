/**
 * Reconcile Flitt's transaction register with our payment_orders ledger, and
 * check orders that never got a callback. Read-only: it reports, it never
 * changes a row or calls a payment action. Runbook: docs/4-integrations/flitt.md
 * → "Daily reconciliation".
 *
 *   # 1) The day's register (CSV from the portal / the daily email):
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx scripts/flitt-reconcile.ts register <file.csv> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--amount-unit auto|major|minor]
 *
 *   # 2) Orders still "pending" here: ask Flitt for their real status
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… FLITT_MERCHANT_ID=<merchant id> FLITT_SECRET_KEY=<payment key> \
 *     npx tsx scripts/flitt-reconcile.ts pending [--days 3]
 *
 * Pass keys inline — never commit them or put them in a file. Pick the project
 * on purpose: production keys read production data (see CLAUDE.md, "A local
 * production build can hit the PRODUCTION database").
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import FlittPay from '@flittpayments/flitt-node-js-sdk'
import { parseRegister, reconcile, type LedgerRow } from '../lib/flitt/reconcile'

const [mode, ...rest] = process.argv.slice(2)
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

function db() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(2)
  }
  console.error(`Database: ${new URL(url).host}`)
  return createClient(url, key, { auth: { persistSession: false } })
}

async function runRegister(file: string) {
  const unit = (flag('amount-unit') ?? 'auto') as 'auto' | 'major' | 'minor'
  const register = parseRegister(readFileSync(file, 'utf8'), unit)
  if (register.length === 0) {
    console.log('The register has no rows.')
    return
  }
  const from = flag('from')
  const to = flag('to')
  let q = db()
    .from('payment_orders')
    .select('order_id, status, amount_minor, currency, reversal_amount_minor, created_at')
  if (from) q = q.gte('created_at', `${from}T00:00:00+04:00`)
  if (to) q = q.lte('created_at', `${to}T23:59:59+04:00`)
  if (!from && !to) {
    // Without a range only compare the orders the register mentions.
    q = q.in('order_id', register.map((r) => r.order_id).slice(0, 1000))
  }
  const { data, error } = await q
  if (error) {
    console.error('Ledger read failed:', error.message)
    process.exit(1)
  }
  const issues = reconcile(register, (data ?? []) as LedgerRow[])
  console.log(`Register rows: ${register.length}. Ledger rows: ${data?.length ?? 0}. Issues: ${issues.length}.`)
  for (const i of issues) console.log(`${i.kind.padEnd(20)} ${i.order_id}  ${i.detail}`)
  if (issues.length) process.exitCode = 1
}

async function runPending() {
  const merchantId = Number(process.env.FLITT_MERCHANT_ID)
  const secretKey = process.env.FLITT_SECRET_KEY
  if (!merchantId || !secretKey) {
    console.error('Set FLITT_MERCHANT_ID and FLITT_SECRET_KEY.')
    process.exit(2)
  }
  const days = Number(flag('days') ?? 3)
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const olderThan = new Date(Date.now() - 30 * 60_000).toISOString()
  const { data, error } = await db()
    .from('payment_orders')
    .select('order_id, created_at')
    .eq('status', 'pending')
    .gte('created_at', since)
    .lte('created_at', olderThan)
    .order('created_at')
  if (error) {
    console.error('Ledger read failed:', error.message)
    process.exit(1)
  }
  const flitt = new FlittPay({ merchantId, secretKey })
  let missed = 0
  for (const row of data ?? []) {
    try {
      const res = (await flitt.Status({ order_id: row.order_id })) as Record<string, unknown>
      const status = String(res.order_status ?? res.response_status ?? 'unknown')
      const note = status === 'approved' ? '  ← paid at Flitt: resend the callback from the portal' : ''
      if (note) missed++
      console.log(`${row.created_at}  ${row.order_id}  ${status}${note}`)
    } catch (err) {
      console.log(`${row.created_at}  ${row.order_id}  status check failed: ${(err as Error).message}`)
    }
  }
  console.log(`Pending here: ${data?.length ?? 0}. Paid at Flitt without a callback: ${missed}.`)
  if (missed) process.exitCode = 1
}

async function main() {
  if (mode === 'register' && rest[0] && !rest[0].startsWith('--')) await runRegister(rest[0])
  else if (mode === 'pending') await runPending()
  else {
    console.error('Usage: flitt-reconcile.ts register <file.csv> [--from D] [--to D] [--amount-unit auto|major|minor]\n       flitt-reconcile.ts pending [--days N]')
    process.exit(2)
  }
}

void main()

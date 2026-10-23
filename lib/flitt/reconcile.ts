/**
 * Reconcile Flitt's daily transaction register with our `payment_orders`
 * ledger — pure (no I/O, unit-tested). The operator script is
 * scripts/flitt-reconcile.ts; runbook in docs/4-integrations/flitt.md.
 *
 * Why: the signed callback is our only live signal. A lost callback leaves a
 * paid customer locked out, a refund done in the portal may never reach us,
 * and payouts arrive net of fees, so the bank statement can't be matched
 * against our amounts. The provider's register is the independent record.
 */

export interface RegisterRow {
  order_id: string
  status: string
  amount_minor: number | null
  currency: string | null
  reversal_minor: number | null
}

export interface LedgerRow {
  order_id: string
  status: string
  amount_minor: number
  currency: string
  reversal_amount_minor?: number | null
}

export type IssueKind =
  | 'missing_in_ledger' // Flitt charged an order we have no row for
  | 'not_activated' // Flitt says approved, our row isn't (lost callback)
  | 'amount_mismatch'
  | 'refund_not_recorded' // refunded at Flitt, not in our row
  | 'missing_in_register' // we think it's paid, the register doesn't list it

export interface Issue {
  kind: IssueKind
  order_id: string
  detail: string
}

const HEADER_ALIASES: Record<keyof RegisterRow, string[]> = {
  order_id: ['order_id', 'order id', 'orderid', 'merchant order id', 'номер заказа', 'შეკვეთის ნომერი'],
  status: ['order_status', 'status', 'статус', 'სტატუსი'],
  amount_minor: ['amount', 'сумма', 'თანხა'],
  currency: ['currency', 'валюта', 'ვალუტა'],
  reversal_minor: ['reversal_amount', 'refund amount', 'reversal amount', 'сумма возврата'],
}

/** Minimal CSV parser: quoted fields, `,` or `;` delimiter (picked from the header). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

/**
 * Amount → minor units. `unit: 'auto'` reads a value with a decimal separator
 * ("49.00", "49,00") as major units and a plain integer as minor units — the
 * API and the portal export differ, so check one known row when in doubt.
 */
export function toMinor(raw: string | undefined, unit: 'auto' | 'major' | 'minor' = 'auto'): number | null {
  if (raw === undefined) return null
  const v = raw.replace(/\s/g, '').replace(/[^\d.,-]/g, '')
  if (!v) return null
  const hasDecimal = /[.,]\d{1,2}$/.test(v)
  const n = Number(v.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const major = unit === 'major' || (unit === 'auto' && hasDecimal)
  return Math.round(major ? n * 100 : n)
}

export function parseRegister(text: string, unit: 'auto' | 'major' | 'minor' = 'auto'): RegisterRow[] {
  const [header, ...body] = parseCsv(text)
  if (!header) return []
  const norm = header.map((h) => h.trim().toLowerCase())
  const col = (k: keyof RegisterRow) => norm.findIndex((h) => HEADER_ALIASES[k].includes(h))
  const idx = {
    order_id: col('order_id'),
    status: col('status'),
    amount_minor: col('amount_minor'),
    currency: col('currency'),
    reversal_minor: col('reversal_minor'),
  }
  if (idx.order_id < 0) throw new Error(`No order id column in the register header: ${header.join(', ')}`)
  return body
    .map((r) => ({
      order_id: (r[idx.order_id] ?? '').trim(),
      status: idx.status >= 0 ? (r[idx.status] ?? '').trim().toLowerCase() : '',
      amount_minor: idx.amount_minor >= 0 ? toMinor(r[idx.amount_minor], unit) : null,
      currency: idx.currency >= 0 ? (r[idx.currency] ?? '').trim().toUpperCase() || null : null,
      reversal_minor: idx.reversal_minor >= 0 ? toMinor(r[idx.reversal_minor], unit) : null,
    }))
    .filter((r) => r.order_id !== '')
}

const PAID = new Set(['approved', 'reversed'])

/**
 * Compare one period's register with our ledger rows for the same period.
 * Renewal rows we store as `<order_id>:<payment_id>` match the register's
 * order id by prefix.
 */
export function reconcile(register: RegisterRow[], ledger: LedgerRow[]): Issue[] {
  const issues: Issue[] = []
  const byId = new Map(ledger.map((l) => [l.order_id, l]))
  const seen = new Set<string>()

  for (const r of register) {
    const l = byId.get(r.order_id)
    if (!l) {
      if (PAID.has(r.status)) {
        issues.push({ kind: 'missing_in_ledger', order_id: r.order_id, detail: `register status ${r.status}` })
      }
      continue
    }
    seen.add(l.order_id)
    if (r.status === 'approved' && !PAID.has(l.status)) {
      issues.push({ kind: 'not_activated', order_id: r.order_id, detail: `ledger status ${l.status}` })
    }
    if (r.amount_minor !== null && r.amount_minor !== l.amount_minor) {
      issues.push({ kind: 'amount_mismatch', order_id: r.order_id, detail: `register ${r.amount_minor}, ledger ${l.amount_minor}` })
    } else if (r.currency && r.currency !== l.currency) {
      issues.push({ kind: 'amount_mismatch', order_id: r.order_id, detail: `register ${r.currency}, ledger ${l.currency}` })
    }
    const refunded = r.status === 'reversed' || (r.reversal_minor ?? 0) > 0
    const recorded = l.status === 'reversed' || (l.reversal_amount_minor ?? 0) > 0
    if (refunded && !recorded) {
      issues.push({ kind: 'refund_not_recorded', order_id: r.order_id, detail: `reversal ${r.reversal_minor ?? 'full'}` })
    }
  }

  const registerIds = new Set(register.map((r) => r.order_id))
  for (const l of ledger) {
    if (!PAID.has(l.status) || seen.has(l.order_id)) continue
    const root = l.order_id.split(':')[0]!
    if (registerIds.has(l.order_id) || registerIds.has(root)) continue
    issues.push({ kind: 'missing_in_register', order_id: l.order_id, detail: `ledger status ${l.status}` })
  }
  return issues
}

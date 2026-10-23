import { getLocale, getTranslations } from 'next-intl/server'
import type { SupabaseClient } from '@supabase/supabase-js'

interface DisclosureRow {
  id: string
  disclosed_at: string
  recipient: string
  data_categories: string[]
  purpose: string
  legal_basis: string
  related_ref: string | null
}

const DATE_LOCALE = { en: 'en-US', ka: 'ka-GE', ru: 'ru-RU' } as const

/**
 * Settings → Audit log: the register of personal data HRHandle passed on for
 * this organization (lib/data-disclosures.ts). Owners/admins only (RLS). Hidden
 * when the table isn't there yet (migration 20261023_payment_records.sql).
 */
export async function DataDisclosures({ supabase }: { supabase: SupabaseClient }) {
  const { data, error } = await supabase
    .from('data_disclosures')
    .select('id, disclosed_at, recipient, data_categories, purpose, legal_basis, related_ref')
    .order('disclosed_at', { ascending: false })
    .limit(50)
  if (error) return null
  const rows = (data ?? []) as DisclosureRow[]

  const t = await getTranslations('disclosures')
  const locale = (await getLocale()) as keyof typeof DATE_LOCALE
  const fmt = new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? 'en-US', {
    dateStyle: 'medium',
    timeZone: 'Asia/Tbilisi',
  })
  const label = (group: 'purpose' | 'basis' | 'category', key: string) =>
    t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('sub')}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border px-5 py-4 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('date')}</th>
                <th className="px-3 py-2 font-medium">{t('recipient')}</th>
                <th className="px-3 py-2 font-medium">{t('data')}</th>
                <th className="px-3 py-2 font-medium">{t('why')}</th>
                <th className="px-4 py-2 font-medium">{t('basisTitle')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{fmt.format(new Date(r.disclosed_at))}</td>
                  <td className="px-3 py-2">{r.recipient}</td>
                  <td className="px-3 py-2">{r.data_categories.map((c) => label('category', c)).join(', ')}</td>
                  <td className="px-3 py-2">{label('purpose', r.purpose)}</td>
                  <td className="px-4 py-2">{label('basis', r.legal_basis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

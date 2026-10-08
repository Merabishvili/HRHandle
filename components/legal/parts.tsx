import type { ReactNode } from 'react'
import { BUSINESS_ID, BUSINESS_IDENTITY, SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/legal/contact'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Building blocks for the legal documents (components/legal/content/*). Every
 * language version uses the same pieces, so the pages stay visually identical
 * and the contact block can't drift between languages.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-4 font-medium">{children}</h3>
}

export function P({ children, first }: { children: ReactNode; first?: boolean }) {
  return <p className={first ? undefined : 'mt-3'}>{children}</p>
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5">{children}</ul>
}

export function Mail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
      {SUPPORT_EMAIL}
    </a>
  )
}

export function Table({ head, rows }: { head: [string, string, string]; rows: Array<[string, string, string]> }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {head.map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r[0]}>
              <td className="py-2 pr-4">{r[0]}</td>
              <td className="py-2 pr-4">{r[1]}</td>
              <td className="py-2">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CONTACT_LABELS: Record<Locale, { id: string; phone: string; controller: string }> = {
  en: { id: 'Identification number', phone: 'Phone', controller: 'Data controller' },
  ka: { id: 'საიდენტიფიკაციო ნომერი', phone: 'ტელეფონი', controller: 'მონაცემთა დამმუშავებელი' },
  ru: { id: 'Идентификационный номер', phone: 'Телефон', controller: 'Контролёр данных' },
}

/** The legal entity + contact details, in the page's language. */
export function ContactBlock({ locale, controller }: { locale: Locale; controller?: boolean }) {
  const l = CONTACT_LABELS[locale]
  const who = BUSINESS_IDENTITY[locale]
  return (
    <p>
      {controller ? `${l.controller}: ` : null}
      {who.name}
      <br />
      {l.id}: {BUSINESS_ID}
      <br />
      {who.address}
      <br />
      <Mail />
      <br />
      {l.phone}: {SUPPORT_PHONE}
    </p>
  )
}

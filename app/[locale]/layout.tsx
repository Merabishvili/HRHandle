import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'

/**
 * Locale-prefixed public routes (i18n Slice 3b — SEO path segments). Only the
 * public SEO surface lives here (`/[locale]/jobs/...`); the dashboard stays
 * un-prefixed and cookie-driven. `localePrefix: 'as-needed'` means English has
 * no prefix (the middleware rewrites `/jobs/...` → `/en/jobs/...` internally).
 * The page itself resolves the display locale (URL locale validated against the
 * org's enabled set), so this layout only guards the segment.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return children
}

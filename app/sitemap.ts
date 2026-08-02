import type { MetadataRoute } from 'next'
import { listExistingGuideSlugs } from '@/lib/guides/loader'
import { createAdminClient } from '@/lib/supabase/admin'
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locales'

const base = 'https://hrhandle.com'

/** As-needed locale prefix: English is canonical (no prefix). */
function jobsUrl(locale: string, slug: string): string {
  return locale === DEFAULT_LOCALE ? `${base}/jobs/${slug}` : `${base}/${locale}/jobs/${slug}`
}

/** Public org careers pages, each with per-locale hreflang alternates (i18n
 * Slice 3b — job listings ranking per language). Best-effort: a query failure
 * just omits them, leaving the static entries intact. */
async function careersEntries(lastModified: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('organizations')
      .select('public_page_slug')
      .not('public_page_slug', 'is', null)
      .is('deleted_at', null)
    const slugs = [...new Set((data ?? []).map((o) => o.public_page_slug as string).filter(Boolean))]
    return slugs.map((slug) => ({
      url: jobsUrl(DEFAULT_LOCALE, slug),
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, jobsUrl(l, slug)])),
      },
    }))
  } catch (err) {
    console.error('[sitemap] careers enumeration failed:', err)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  const guideSlugs = await listExistingGuideSlugs()
  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((slug) => ({
    url: `${base}/guide/${slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [
    { url: base, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/guide`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    ...guideEntries,
    ...(await careersEntries(lastModified)),
    { url: `${base}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/refund`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
}

import type { MetadataRoute } from 'next'
import { listExistingGuideSlugs } from '@/lib/guides/loader'
import { createAdminClient } from '@/lib/supabase/admin'

const base = 'https://hrhandle.com'

/** Public org careers pages. Each org publishes in a single content language,
 * so there is one canonical URL per org (no per-locale hreflang alternates).
 * Best-effort: a query failure just omits them, leaving the static entries. */
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
      url: `${base}/jobs/${slug}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
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

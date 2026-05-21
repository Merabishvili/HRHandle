import type { MetadataRoute } from 'next'
import { listExistingGuideSlugs } from '@/lib/guides/loader'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://hrhandle.com'
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
    { url: `${base}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/refund`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
}

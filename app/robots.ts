import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/refund', '/guide'],
        disallow: ['/dashboard', '/pipeline', '/vacancies', '/candidates', '/interviews', '/reports', '/settings', '/subscription', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://hrhandle.com/sitemap.xml',
  }
}

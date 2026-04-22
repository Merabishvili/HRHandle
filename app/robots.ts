import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/refund'],
        disallow: ['/dashboard', '/vacancies', '/candidates', '/interviews', '/settings', '/subscription', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://hrhandle.com/sitemap.xml',
  }
}

import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Georgian } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { PostHogProvider } from './providers'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

// Geist ships no Georgian glyphs, so Georgian text falls back to a system
// font — and bold Georgian gets a faux-bold/different fallback face, making
// mixed bold+regular Georgian look like two typefaces. Noto Sans Georgian is
// a variable font (all weights) that we append to the sans stack: Latin keeps
// Geist, Georgian glyphs resolve to Noto Sans Georgian at every weight.
const notoGeorgian = Noto_Sans_Georgian({
  subsets: ['georgian'],
  variable: '--font-noto-georgian',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hrhandle.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HRHandle — Applicant Tracking System for Growing Teams',
    template: '%s — HRHandle',
  },
  description:
    'HRHandle is a modern ATS that helps you manage job vacancies, track candidates through your hiring pipeline, and schedule interviews — all in one place.',
  keywords: [
    'applicant tracking system',
    'ATS',
    'recruitment software',
    'hiring software',
    'HR software',
    'candidate tracking',
    'job vacancy management',
    'interview scheduling',
  ],
  authors: [{ name: 'HRHandle' }],
  creator: 'HRHandle',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'HRHandle',
    title: 'HRHandle — Applicant Tracking System for Growing Teams',
    description:
      'Manage vacancies, track candidates, and schedule interviews with HRHandle. Simple, modern ATS for teams of any size.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'HRHandle — Applicant Tracking System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HRHandle — Applicant Tracking System for Growing Teams',
    description:
      'Manage vacancies, track candidates, and schedule interviews with HRHandle.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Resolve the request locale + messages from i18n/request.ts (cookie-based).
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} bg-background`}
    >
      <body className="min-h-screen font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>{children}</PostHogProvider>
          <Toaster />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
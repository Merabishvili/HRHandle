import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://hrhandle.com'),
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
    url: 'https://hrhandle.com',
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
    canonical: 'https://hrhandle.com',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
    >
      <body className="min-h-screen font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
import type { Metadata } from 'next'

// Token-gated candidate-facing layout. Same robots-noindex policy as the
// status page (G-016) — the URL is candidate-facing but private; indexing
// it would either 404 (token unknown) or leak the URL's existence.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}

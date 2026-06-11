import type { Metadata } from 'next'

// Public, unauthenticated layout for the candidate status page (G-016).
// Robots-blocked on purpose: the URL is candidate-facing but token-gated;
// indexing it would either show a 404 (token unknown) or leak the URL's
// existence into search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}

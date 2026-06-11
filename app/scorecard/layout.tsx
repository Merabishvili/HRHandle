import type { Metadata } from 'next'

// Token-gated public layout for shared candidate scorecards (G-025). Same
// robots-noindex policy as /status and /offer — the URL is meant to be
// shared with a specific person, not indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ScorecardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}

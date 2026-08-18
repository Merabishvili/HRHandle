import Link from 'next/link'

export default function ScorecardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Link no longer valid</h1>
      <p className="mt-3 text-sm text-gray-600">
        This scorecard link is invalid or has been revoked by the recruiter. If
        you believe this is a mistake, please contact the recruiter directly.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Go to HRHandle
      </Link>
    </main>
  )
}

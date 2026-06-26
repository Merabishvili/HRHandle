'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Root-level error boundary. Next.js renders this (replacing the whole layout)
 * when an error escapes the root layout/template, so it must ship its own
 * <html>/<body>. We forward the error to Sentry here — client render errors
 * that bubble this far are otherwise not captured.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans antialiased">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred and our team has been notified. Try again,
            or reload the page.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-muted-foreground/70">
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

import Link from 'next/link'
import { format } from 'date-fns'
import { Sparkles, Pencil, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface JdTabProps {
  vacancyId: string
  description: string | null
  responsibilities: string | null
  requirements: string | null
  postingDetails: {
    visibility: 'public' | 'private'
    language: string | null
    lastEditedAt: string | null
  }
  applicationFormToken: string | null
}

/**
 * Wave 2.4 Job description tab per Vacancy Detail.dc.html.
 *
 * Left: a single "About the role" card hosting the published JD with two
 * actions in the header — "Improve with AI" (calm-blue trigger that
 * routes into the existing JD-suggest panel via deep link) and "Edit"
 * (links to the vacancy edit form).
 *
 * Right rail: Posting details card (visibility + language + last edited)
 * + Preview apply page card that opens the public apply form in a new
 * tab so the recruiter can sanity-check what candidates see.
 */
export function JdTab({
  vacancyId,
  description,
  responsibilities,
  requirements,
  postingDetails,
  applicationFormToken,
}: JdTabProps) {
  return (
    <div className="flex flex-col gap-4 bg-[oklch(0.985_0.002_247)] p-5 sm:flex-row sm:p-6">
      {/* Left — About the role */}
      <article className="flex-1 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-5 sm:p-[22px]">
        <header className="mb-4 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[17px] font-bold text-foreground">About the role</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-[oklch(0.88_0.05_250)] text-[oklch(0.45_0.16_250)] hover:bg-[oklch(0.96_0.03_250)] hover:text-[oklch(0.35_0.14_250)]"
            >
              <Link href={`/vacancies/${vacancyId}/edit#ai-suggest`}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Improve with AI
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={`/vacancies/${vacancyId}/edit`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Link>
            </Button>
          </div>
        </header>

        <div className="space-y-3.5 text-[13.5px] leading-[1.7] text-foreground/85">
          {description ? (
            <p className="whitespace-pre-wrap">{description}</p>
          ) : (
            <p className="italic text-muted-foreground">
              No description yet — click <span className="font-semibold">Improve with AI</span> to draft one from the role title, or <span className="font-semibold">Edit</span> to write it manually.
            </p>
          )}

          {responsibilities && (
            <section>
              <h3 className="mb-1.5 text-[14px] font-bold text-foreground">What you&apos;ll do</h3>
              <div className="whitespace-pre-wrap">{responsibilities}</div>
            </section>
          )}

          {requirements && (
            <section>
              <h3 className="mb-1.5 text-[14px] font-bold text-foreground">What you&apos;ll bring</h3>
              <div className="whitespace-pre-wrap">{requirements}</div>
            </section>
          )}
        </div>
      </article>

      {/* Right rail */}
      <aside className="flex w-full shrink-0 flex-col gap-3.5 sm:w-[300px]">
        <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label="Posting details">
          <h2 className="mb-3 text-[15px] font-bold text-foreground">Posting details</h2>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Visibility</span>
              <span className="font-semibold text-foreground">
                {postingDetails.visibility === 'public' ? 'Public' : 'Private'}
              </span>
            </li>
            {postingDetails.language && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Language</span>
                <span className="font-semibold text-foreground">{postingDetails.language}</span>
              </li>
            )}
            {postingDetails.lastEditedAt && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Last edited</span>
                <span className="font-semibold text-foreground">
                  {format(new Date(postingDetails.lastEditedAt), 'MMM d, yyyy')}
                </span>
              </li>
            )}
          </ul>
        </section>

        {applicationFormToken && (
          <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label="Preview apply page">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.05em] text-[oklch(0.45_0.16_250)]">
              Preview
            </p>
            <p className="text-[12px] leading-[1.5] text-muted-foreground">
              See exactly what candidates see on the public apply page.
            </p>
            <a
              href={`/apply/${applicationFormToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[oklch(0.88_0.01_250)] px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Preview apply page
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </section>
        )}
      </aside>
    </div>
  )
}

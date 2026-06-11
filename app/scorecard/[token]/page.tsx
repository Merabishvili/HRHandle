import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Briefcase, Building2, UserCircle } from 'lucide-react'

import { getScorecardByToken } from '@/lib/actions/scorecards'

interface PageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Public, token-gated scorecard page (G-025). Mirrors the G-016 status page
// + G-018 offer page risk model: token is the credential, lookup via the
// admin client, 404 on missing / revoked / soft-deleted parents so the URL
// can't be used to confirm whether a particular evaluation ever existed.
export default async function ScorecardPage({ params }: PageProps) {
  const { token } = await params
  const result = await getScorecardByToken(token)
  if (!result.success) notFound()
  const sc = result.data

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          Candidate scorecard
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          {sc.candidate_full_name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          for <strong className="font-semibold text-gray-900">{sc.role_title}</strong> at{' '}
          <strong className="font-semibold text-gray-900">{sc.organization_name}</strong>
        </p>
        {(sc.shared_by_name || sc.shared_at) && (
          <p className="mt-3 text-xs text-gray-500">
            Shared
            {sc.shared_by_name ? ` by ${sc.shared_by_name}` : ''}
            {sc.shared_at ? ` on ${format(new Date(sc.shared_at), 'MMMM d, yyyy')}` : ''}
          </p>
        )}
      </header>

      <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Summary tile */}
        <dl className="space-y-3 text-sm">
          <Row icon={UserCircle} label="Candidate">
            <span className="font-medium text-gray-900">{sc.candidate_full_name}</span>
          </Row>
          <Row icon={Briefcase} label="Role">
            <span className="text-gray-700">{sc.role_title}</span>
          </Row>
          <Row icon={Building2} label="Employer">
            <span className="text-gray-700">{sc.organization_name}</span>
          </Row>
        </dl>

        {sc.view.overallScore !== null && (
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
              Overall score
            </p>
            <p className="mt-1 text-3xl font-bold text-indigo-900">
              {sc.view.overallScore}
              <span className="text-base font-normal text-indigo-700"> / 100</span>
            </p>
          </div>
        )}

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Evaluation
          </h2>
          {sc.view.items.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              The recruiter hasn&apos;t filled in any answers yet.
            </p>
          ) : (
            <div className="mt-3 space-y-5">
              {sc.view.items.map((item) =>
                item.kind === 'score' ? (
                  <ScoreItem key={item.questionId} item={item} />
                ) : (
                  <TextItem key={item.questionId} item={item} />
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs text-gray-500">
        <p>
          This page only shows what the recruiter chose to share. It does not include
          contact information, recruiter notes, or pipeline status.
        </p>
      </footer>
    </main>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      <div className="flex-1">
        <dt className="sr-only">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  )
}

function ScoreItem({
  item,
}: {
  item: { questionId: string; label: string; score: number; max: number; percentage: number }
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{item.label}</p>
        <p className="shrink-0 text-sm font-semibold text-gray-900">
          {item.score}
          <span className="text-gray-500"> / {item.max}</span>
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-full bg-gray-200"
        aria-hidden
      >
        <div
          className="h-2 rounded-full bg-indigo-600"
          style={{ width: `${item.percentage}%` }}
        />
      </div>
    </div>
  )
}

function TextItem({
  item,
}: {
  item: { questionId: string; label: string; text: string }
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{item.label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {item.text}
      </p>
    </div>
  )
}

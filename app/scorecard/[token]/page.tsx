import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Briefcase, Building2, UserCircle } from 'lucide-react'

import { getScorecardByToken } from '@/lib/actions/scorecards'
import { dateFnsLocale, formatShortDate } from '@/lib/i18n/date-locale'
import { averageOfScores, type ScorecardItem } from '@/lib/scorecards/projection'
import type { ScorecardRecommendation } from '@/lib/actions/evaluations'

interface PageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const REC_LABEL_KEY: Record<ScorecardRecommendation, string> = {
  strong_yes: 'scoreModal.recStrongYes',
  yes: 'scoreModal.recYes',
  lean_no: 'scoreModal.recLeanNo',
  no: 'scoreModal.recNo',
}

const REC_STYLE: Record<ScorecardRecommendation, string> = {
  strong_yes: 'bg-emerald-100 text-emerald-800',
  yes: 'bg-emerald-50 text-emerald-700',
  lean_no: 'bg-amber-50 text-amber-800',
  no: 'bg-red-50 text-red-700',
}

// Public, token-gated page for one shared assessment (G-025). Mirrors the
// G-016 status page + G-018 offer page risk model: token is the credential,
// lookup via the admin client, 404 on missing / revoked / soft-deleted parents
// so the URL can't be used to confirm whether a particular assessment ever
// existed. Rendered in the organization's content language.
export default async function ScorecardPage({ params }: PageProps) {
  const { token } = await params
  const result = await getScorecardByToken(token)
  if (!result.success) notFound()
  const sc = result.data
  const t = await getTranslations({ locale: sc.locale })
  const dfLocale = dateFnsLocale(sc.locale)

  const scores = sc.view.items.filter((i): i is Extract<ScorecardItem, { kind: 'score' }> => i.kind === 'score')
  const answers = sc.view.items.filter((i): i is Extract<ScorecardItem, { kind: 'text' }> => i.kind === 'text')
  const average = averageOfScores(scores)

  return (
    <main lang={sc.locale} className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {t('scorecardPage.eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          {sc.candidate_full_name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t.rich('scorecardPage.forRoleAt', {
            role: sc.role_title,
            org: sc.organization_name,
            b: (c) => <strong className="font-semibold text-gray-900">{c}</strong>,
          })}
        </p>
        {sc.shared_by_name && (
          <p className="mt-3 text-xs text-gray-500">
            {t('scorecardPage.sharedBy', {
              name: sc.shared_by_name,
              date: sc.shared_at ? formatShortDate(new Date(sc.shared_at), dfLocale) : '',
            })}
          </p>
        )}
      </header>

      <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <dl className="space-y-3 text-sm">
          <Row icon={UserCircle} label={t('scorecardPage.candidate')}>
            <span className="font-medium text-gray-900">{sc.candidate_full_name}</span>
          </Row>
          <Row icon={Briefcase} label={t('scorecardPage.role')}>
            <span className="text-gray-700">{sc.role_title}</span>
          </Row>
          <Row icon={Building2} label={t('scorecardPage.employer')}>
            <span className="text-gray-700">{sc.organization_name}</span>
          </Row>
        </dl>

        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-indigo-50 p-4">
          {average !== null && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
                {t('scorecardPage.average')}
              </p>
              <p className="mt-1 text-3xl font-bold text-indigo-900">
                {average}
                <span className="text-base font-normal text-indigo-700"> / 5</span>
              </p>
            </div>
          )}
          <div className="text-sm text-indigo-900">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
              {t('scorecardPage.assessor')}
            </p>
            <p className="mt-1 font-semibold">
              {sc.assessor_name ?? t('scorecardPage.unknownAssessor')}
              <span className="font-normal text-indigo-700"> · {formatShortDate(new Date(sc.assessed_at), dfLocale)}</span>
            </p>
          </div>
        </div>

        {scores.length === 0 && answers.length === 0 && !sc.recommendation ? (
          <p className="text-sm text-gray-600">{t('scorecardPage.empty')}</p>
        ) : (
          <>
            {scores.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('assess.criteriaHeading')}
                </h2>
                <div className="mt-3 space-y-5">
                  {scores.map((item) => <ScoreItem key={item.questionId} item={item} />)}
                </div>
              </div>
            )}

            {answers.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('assess.answersHeading')}
                </h2>
                <div className="mt-3 space-y-5">
                  {answers.map((item) => <TextItem key={item.questionId} item={item} />)}
                </div>
              </div>
            )}

            {sc.recommendation && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('assess.recommendation')}
                </h2>
                <span className={`mt-3 inline-block rounded px-2 py-0.5 text-sm font-bold ${REC_STYLE[sc.recommendation]}`}>
                  {t(REC_LABEL_KEY[sc.recommendation])}
                </span>
                {sc.recommendation_reason && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {sc.recommendation_reason}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <footer className="mt-6 space-y-1 text-center text-xs text-gray-500">
        <p>{t('scorecardPage.footer')}</p>
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

import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { getTranslations } from 'next-intl/server'
import { AlertTriangle, ArrowRight, Copy } from 'lucide-react'

import { getStageStyle } from '@/lib/pipeline/stage-style'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'

export interface AttentionItem {
  /** Key for React reconciliation + click tracking. */
  id: string
  /** Optional small initials tile rendered on the left of the row. */
  initials: string | null
  initialsHue: 'blue' | 'amber' | 'purple' | 'cyan' | 'green' | 'neutral'
  /** Main copy — render JSX so the caller can bold key fragments. */
  message: React.ReactNode
  ctaLabel: string
  ctaHref: string
}

interface OverviewTabProps {
  vacancyId: string
  meta: {
    timeOpenDays: number
    activeCandidateCount: number
    salaryRangeLabel: string | null
    endDate: string | null
    healthLabel: 'good' | 'watch' | 'stale'
  }
  attention: AttentionItem[]
  /** Counts per non-terminal stage, in stage sort order. Used to render
   * the compact funnel strip. */
  funnel: {
    statusId: string
    code: ApplicationStatus['code']
    name: string
    count: number
  }[]
  hiringManagerName: string | null
  currentUserName: string
  applicationFormToken: string | null
}

/**
 * Wave 2.4 Overview tab — Version B (needs-attention first) with Version
 * A's time-to-fill benchmark folded into the "At a glance" card, per the
 * design's "MY TAKE" recommendation.
 *
 * Layout:
 *   LEFT  → Needs-attention card (or empty state) + Compact pipeline strip
 *   RIGHT → At-a-glance card + Hiring team card + Share card
 */
export async function OverviewTab({
  vacancyId,
  meta,
  attention,
  funnel,
  hiringManagerName,
  currentUserName,
  applicationFormToken,
}: OverviewTabProps) {
  const t = await getTranslations()
  const healthStyle = getHealthStyle(meta.healthLabel)
  const healthLabelText = t(healthStyle.labelKey)

  return (
    <div className="flex flex-col gap-4 bg-[oklch(0.985_0.002_247)] p-5 sm:flex-row sm:p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Needs your attention */}
        {attention.length > 0 ? (
          <section
            className="rounded-xl border bg-[oklch(0.995_0.01_80)] p-4 sm:p-[18px]"
            style={{ borderColor: 'oklch(0.86 0.06 70)' }}
            aria-label={t('vacOverview.needsAttentionAria')}
          >
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[oklch(0.5_0.12_60)]" aria-hidden />
              <h2 className="text-[15px] font-bold text-foreground">
                {t('vacOverview.needsAttention', { count: attention.length })}
              </h2>
            </div>
            <ul className="flex flex-col gap-2">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.ctaHref}
                    className="flex items-center gap-2.5 rounded-[9px] border border-[oklch(0.92_0.02_70)] bg-white px-3 py-2.5 transition-colors hover:border-[oklch(0.85_0.06_70)]"
                  >
                    {item.initials ? (
                      <span
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold"
                        style={initialsStyle(item.initialsHue)}
                        aria-hidden
                      >
                        {item.initials}
                      </span>
                    ) : (
                      <span className="h-[26px] w-[26px] shrink-0" aria-hidden />
                    )}
                    <span className="flex-1 text-[13px] text-foreground">{item.message}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[oklch(0.55_0.18_250)]">
                      {item.ctaLabel}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section
            className="rounded-xl border border-dashed border-border bg-white p-5 text-center text-[13px] text-muted-foreground"
            aria-label={t('vacOverview.nothingAria')}
          >
            {t('vacOverview.nothingBlocking')}
          </section>
        )}

        {/* Pipeline strip */}
        <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('vacOverview.pipeline')}>
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-foreground">{t('vacOverview.pipeline')}</h2>
            <Link
              href={`/vacancies/${vacancyId}/pipeline`}
              className="text-[12.5px] font-semibold text-[oklch(0.55_0.18_250)] hover:underline"
            >
              {t('vacOverview.openBoard')}
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {funnel.map((stage, idx) => {
              const style = getStageStyle(stage.code)
              const isLast = stage.code === 'hired'
              // Width-weighted by count vs. the max — keeps the visual cue
              // of pipeline shape even when totals are small.
              const max = Math.max(1, ...funnel.map((s) => s.count))
              const ratio = Math.max(0.5, stage.count / max)
              const flexGrow = isLast ? 1 : 1 + ratio
              return (
                <div
                  key={stage.statusId}
                  className="min-w-[88px] rounded-lg px-3 py-2.5"
                  style={{
                    background: stage.count === 0 && isLast ? undefined : style.columnBg,
                    border: stage.count === 0 && isLast ? `1px dashed ${style.columnBorder}` : undefined,
                    flexGrow,
                  }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: style.pillText }}>
                    {statusLabel(t, stage.code, stage.name)}
                  </p>
                  <p
                    className={`mt-0.5 text-[19px] font-bold ${stage.count === 0 ? 'opacity-60' : ''}`}
                    style={{ color: style.pillText }}
                  >
                    {stage.count}
                    {idx === 0 && stage.count > 0 && stage.count <= 99 ? (
                      <span className="sr-only"> applied</span>
                    ) : null}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Right rail */}
      <aside className="flex w-full shrink-0 flex-col gap-3.5 sm:w-[340px]">
        {/* At a glance */}
        <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('vacOverview.atAGlance')}>
          <h2 className="mb-3 text-[15px] font-bold text-foreground">{t('vacOverview.atAGlance')}</h2>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('vacOverview.timeOpen')}</span>
              <span className="font-semibold text-foreground">
                {t('vacOverview.days', { count: meta.timeOpenDays })}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('vacOverview.activeCandidates')}</span>
              <span className="font-semibold text-foreground">{meta.activeCandidateCount}</span>
            </li>
            {meta.salaryRangeLabel && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('vacOverview.salaryRange')}</span>
                <span className="font-semibold text-foreground">{meta.salaryRangeLabel}</span>
              </li>
            )}
            {meta.endDate && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('vacOverview.endDate')}</span>
                <span className="font-semibold text-foreground">{meta.endDate}</span>
              </li>
            )}
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('vacOverview.health')}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: healthStyle.text }}>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: healthStyle.dot }}
                  aria-hidden
                />
                {healthLabelText}
              </span>
            </li>
          </ul>
        </section>

        {/* Hiring team */}
        <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('vacOverview.hiringTeam')}>
          <h2 className="mb-3 text-[15px] font-bold text-foreground">{t('vacOverview.hiringTeam')}</h2>
          <ul className="flex flex-col gap-2.5">
            {hiringManagerName && (
              <TeamMemberRow
                initials={getInitials(hiringManagerName)}
                hue="green"
                name={hiringManagerName}
                jobTitle={t('vacOverview.hiringManager')}
              />
            )}
            <TeamMemberRow
              initials={getInitials(currentUserName)}
              hue="blue"
              name={t('vacOverview.you')}
              jobTitle={t('vacOverview.recruiter')}
            />
          </ul>
        </section>

        {/* Share */}
        {applicationFormToken && (
          <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('vacOverview.share')}>
            <h2 className="mb-2.5 text-[15px] font-bold text-foreground">{t('vacOverview.share')}</h2>
            <div className="flex items-center gap-2 rounded-lg border border-[oklch(0.92_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-2 text-[11.5px]">
              <span className="flex-1 truncate text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_URL ?? ''}/apply/{applicationFormToken.slice(0, 14)}…
              </span>
              <Link
                href={`/vacancies/${vacancyId}?tab=application-form`}
                className="inline-flex items-center gap-0.5 font-semibold text-[oklch(0.55_0.18_250)] hover:underline"
              >
                <Copy className="h-3 w-3" aria-hidden />
                {t('aiJd.copy')}
              </Link>
            </div>
          </section>
        )}
      </aside>
    </div>
  )
}

function TeamMemberRow({
  initials,
  hue,
  name,
  jobTitle,
}: {
  initials: string
  hue: 'blue' | 'green'
  name: string
  jobTitle: string
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={initialsStyle(hue)}
        aria-hidden
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold text-foreground">{name}</p>
        <p className="text-[11px] text-muted-foreground">{jobTitle}</p>
      </div>
    </li>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function initialsStyle(hue: AttentionItem['initialsHue']): React.CSSProperties {
  switch (hue) {
    case 'blue':
      return { background: 'oklch(0.93 0.05 250)', color: 'oklch(0.42 0.16 250)' }
    case 'amber':
      return { background: 'oklch(0.95 0.08 95)', color: 'oklch(0.48 0.11 80)' }
    case 'purple':
      return { background: 'oklch(0.93 0.06 300)', color: 'oklch(0.45 0.15 300)' }
    case 'cyan':
      return { background: 'oklch(0.94 0.06 200)', color: 'oklch(0.42 0.12 210)' }
    case 'green':
      return { background: 'oklch(0.94 0.05 165)', color: 'oklch(0.4 0.1 165)' }
    case 'neutral':
    default:
      return { background: 'oklch(0.95 0.01 250)', color: 'oklch(0.4 0.02 250)' }
  }
}

function getHealthStyle(label: 'good' | 'watch' | 'stale'): {
  text: string
  dot: string
  labelKey: string
} {
  switch (label) {
    case 'good':
      return {
        text: 'oklch(0.35 0.13 145)',
        dot: 'oklch(0.65 0.17 145)',
        labelKey: 'vacOverview.healthGood',
      }
    case 'watch':
      return {
        text: 'oklch(0.48 0.11 80)',
        dot: 'oklch(0.65 0.15 80)',
        labelKey: 'vacOverview.healthWatch',
      }
    case 'stale':
      return {
        text: 'oklch(0.5 0.19 27)',
        dot: 'oklch(0.6 0.18 27)',
        labelKey: 'vacOverview.healthStale',
      }
  }
}

// Helper for the page server component — builds the attention list from
// the raw application + interview data. Exported so the rebuild logic is
// testable in isolation later.
type OverviewTranslator = Awaited<ReturnType<typeof getTranslations>>

export function buildAttentionList(
  {
    vacancyId,
    pendingOffers,
    upcomingInterviewsTomorrow,
    newApplicantCount,
  }: {
    vacancyId: string
    pendingOffers: { applicationId: string; candidateInitials: string; candidateFirstName: string; daysAwaiting: number }[]
    upcomingInterviewsTomorrow: { interviewId: string; candidateInitials: string; candidateFirstName: string; scheduledAt: string }[]
    newApplicantCount: number
  },
  t: OverviewTranslator,
): AttentionItem[] {
  const bold = { b: (chunks: React.ReactNode) => <strong className="font-semibold">{chunks}</strong> }
  const items: AttentionItem[] = []
  for (const o of pendingOffers) {
    items.push({
      id: `offer-${o.applicationId}`,
      initials: o.candidateInitials,
      initialsHue: 'cyan',
      message: t.rich('vacOverview.offerAwaiting', { name: o.candidateFirstName, count: o.daysAwaiting, ...bold }),
      ctaLabel: t('vacOverview.followUp'),
      ctaHref: `/candidates/${o.applicationId}`,
    })
  }
  for (const i of upcomingInterviewsTomorrow) {
    items.push({
      id: `interview-${i.interviewId}`,
      initials: i.candidateInitials,
      initialsHue: 'purple',
      message: t.rich('vacOverview.interviewWith', { name: i.candidateFirstName, time: formatDistanceToNow(new Date(i.scheduledAt), { addSuffix: true }), ...bold }),
      ctaLabel: t('vacOverview.view'),
      ctaHref: `/interviews/${i.interviewId}`,
    })
  }
  if (newApplicantCount > 0) {
    items.push({
      id: 'new-applicants',
      initials: `+${newApplicantCount}`,
      initialsHue: 'blue',
      message: t.rich('vacOverview.newApplicants', { count: newApplicantCount, ...bold }),
      ctaLabel: t('vacOverview.review'),
      ctaHref: `/vacancies/${vacancyId}/pipeline`,
    })
  }
  return items
}

// Exposed so the page can format end-date once instead of duplicating
// the format() call.
export function formatEndDate(value: string | null): string | null {
  if (!value) return null
  return format(new Date(value), 'MMM d, yyyy')
}


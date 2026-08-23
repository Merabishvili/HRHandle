import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Briefcase, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CopyApplyLinkButton } from '@/components/vacancies/copy-apply-link-button'
import { VacancyActionsMenu } from '@/components/vacancies/detail/vacancy-actions-menu'
import { PrevNextNav } from '@/components/ui/prev-next-nav'

interface VacancyHeaderProps {
  vacancyId: string
  title: string
  status: { code: string; name: string } | null
  meta: {
    employmentLabel: string
    department: string | null
    location: string | null
    openedDaysAgo: number
    endDate: string | null
  }
  applicationFormToken: string | null
  /** Adjacent vacancy ids for prev/next paging (#2), or null at a boundary. */
  prevId?: string | null
  nextId?: string | null
}

/**
 * Wave 2.4 shared vacancy header per Vacancy Detail.dc.html.
 *
 * Constant across every tab below. Two horizontal bars stacked:
 *
 *   1. Breadcrumb bar — Vacancies › {title} + (future) Prev/Next role
 *      navigation. Prev/Next is deferred (needs an ordered-list query
 *      from the vacancies list; not in slice 1).
 *
 *   2. Title row — 52×52 brand-blue tinted role icon + title + status
 *      badge + meta line + actions cluster (Copy apply link / View
 *      pipeline filled brand-blue / ⋯ menu with Duplicate + Delete).
 */
export async function VacancyHeader({
  vacancyId,
  title,
  status,
  meta,
  applicationFormToken,
  prevId = null,
  nextId = null,
}: VacancyHeaderProps) {
  const t = await getTranslations()
  return (
    <header>
      {/* Breadcrumb bar */}
      <div className="flex h-[46px] items-center gap-2 border-b border-[oklch(0.93_0.01_250)] px-5 sm:px-6">
        <Link
          href="/vacancies"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('nav.vacancies')}
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />
        <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
        <div className="ml-auto">
          <PrevNextNav
            prevHref={prevId ? `/vacancies/${prevId}` : null}
            nextHref={nextId ? `/vacancies/${nextId}` : null}
            prevLabel={t('nav.prevVacancy')}
            nextLabel={t('nav.nextVacancy')}
          />
        </div>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)] text-[oklch(0.45_0.16_250)]"
             style={{ width: 52, height: 52 }}
             aria-hidden>
          <Briefcase className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] font-bold text-foreground">{title}</h1>
            {status && (
              <span
                className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold"
                style={getStatusStyle(status.code)}
              >
                {t.has(`vacStatus.${status.code}`) ? t(`vacStatus.${status.code}`) : status.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {[
              meta.employmentLabel,
              meta.department,
              meta.location,
              t('vacHeader.openedAgo', { days: meta.openedDaysAgo }),
              meta.endDate ? t('vacHeader.ends', { date: meta.endDate }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {applicationFormToken && (
            <CopyApplyLinkButton token={applicationFormToken} />
          )}
          <Button
            asChild
            size="sm"
            className="h-9 gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
          >
            <Link href={`/vacancies/${vacancyId}/pipeline`}>
              {t('vacHeader.viewPipeline')}
            </Link>
          </Button>
          <VacancyActionsMenu vacancyId={vacancyId} title={title} />
        </div>
      </div>
    </header>
  )
}

function getStatusStyle(code: string): React.CSSProperties {
  switch (code) {
    case 'open':
      return {
        background: 'oklch(0.65 0.17 145 / 0.15)',
        color: 'oklch(0.35 0.13 145)',
      }
    case 'on_hold':
      return {
        background: 'oklch(0.95 0.08 95)',
        color: 'oklch(0.48 0.11 80)',
      }
    case 'closed':
      return {
        background: 'oklch(0.95 0.01 250)',
        color: 'oklch(0.45 0.02 250)',
      }
    case 'draft':
      return {
        background: 'oklch(0.95 0.01 250)',
        color: 'oklch(0.5 0.02 250)',
      }
    default:
      return {
        background: 'oklch(0.95 0.01 250)',
        color: 'oklch(0.5 0.02 250)',
      }
  }
}

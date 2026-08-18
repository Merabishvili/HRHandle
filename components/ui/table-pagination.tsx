'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_PAGE_SIZE,
  getPageWindow,
  PAGE_GAP,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from '@/lib/pagination'

export interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: PageSize
  /** Path the navigation links target, e.g. `/candidates`. */
  basePath: string
  /** All current URL search params except `page` and `pageSize`. These are
   * preserved verbatim on every pagination link so the recruiter's filters
   * survive the navigation. Passing a plain object (rather than a function)
   * keeps the contract serialisable across the server→client boundary
   * required by React Server Components. */
  preservedParams: Record<string, string>
  /** Optional aria-label for the nav landmark. Defaults to "Pagination". */
  ariaLabel?: string
}

export function TablePagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  basePath,
  preservedParams,
  ariaLabel,
}: TablePaginationProps) {
  const t = useTranslations()
  const buildHref = (opts: { page?: number; pageSize?: PageSize }): string => {
    const params = new URLSearchParams(preservedParams)
    const effectivePageSize = opts.pageSize ?? pageSize
    if (effectivePageSize !== DEFAULT_PAGE_SIZE) {
      params.set('pageSize', String(effectivePageSize))
    } else {
      params.delete('pageSize')
    }
    params.set('page', String(opts.page ?? currentPage))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const router = useRouter()
  const safeCurrent = Math.min(Math.max(1, currentPage), Math.max(1, totalPages))
  const from = (safeCurrent - 1) * pageSize + 1
  const to = Math.min(safeCurrent * pageSize, totalCount)
  const pages = getPageWindow(safeCurrent, totalPages)
  const showingLabel =
    totalCount === 0
      ? t('pager.results0')
      : t('pager.showing', { from, to, total: totalCount })

  const handlePageSizeChange = (value: string) => {
    const next = parseInt(value, 10) as PageSize
    if (!PAGE_SIZE_OPTIONS.includes(next)) return
    if (next === pageSize) return
    // Reset to page 1 — see prop docstring.
    router.push(buildHref({ page: 1, pageSize: next }))
  }

  // Hide the whole bar only when there is genuinely nothing to show OR the
  // dataset fits on one page and the user can't pick a smaller size. We still
  // render the row count + page-size selector for >0 results so the UX is
  // consistent.
  if (totalCount === 0) {
    return (
      <div className="flex items-center justify-between border-t border-border px-2 pt-4">
        <p className="text-sm text-muted-foreground">{showingLabel}</p>
      </div>
    )
  }

  return (
    <nav
      aria-label={ariaLabel ?? t('pager.nav')}
      className="flex flex-col gap-3 border-t border-border px-2 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">{showingLabel}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('pager.perPage')}</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[72px] text-xs" aria-label={t('pager.rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            asChild={safeCurrent > 1}
            disabled={safeCurrent === 1}
            aria-label={t('pager.prev')}
            className="h-8 px-2"
          >
            {safeCurrent > 1 ? (
              <Link href={buildHref({ page: safeCurrent - 1 })}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}
          </Button>

          {/* Page numbers — hidden on very small screens; the surrounding
              "Showing X of Y" + Prev/Next still convey progress. */}
          <ul className="hidden items-center gap-1 sm:flex">
            {pages.map((p, i) => {
              if (p === PAGE_GAP) {
                return (
                  <li
                    key={`gap-${i}`}
                    aria-hidden
                    className="px-1.5 text-sm text-muted-foreground"
                  >
                    {PAGE_GAP}
                  </li>
                )
              }
              const isCurrent = p === safeCurrent
              return (
                <li key={p}>
                  <Button
                    variant={isCurrent ? 'default' : 'ghost'}
                    size="sm"
                    asChild={!isCurrent}
                    aria-label={t('pager.pageAria', { page: p })}
                    aria-current={isCurrent ? 'page' : undefined}
                    className="h-8 min-w-[2rem] px-2 text-sm"
                  >
                    {isCurrent ? <span>{p}</span> : <Link href={buildHref({ page: p })}>{p}</Link>}
                  </Button>
                </li>
              )
            })}
          </ul>

          {/* Compact "page N of M" shown only on narrow screens to replace the page list. */}
          <span className="px-2 text-xs text-muted-foreground sm:hidden">
            {t('pager.pageOf', { current: safeCurrent, total: totalPages })}
          </span>

          <Button
            variant="outline"
            size="sm"
            asChild={safeCurrent < totalPages}
            disabled={safeCurrent === totalPages}
            aria-label={t('pager.next')}
            className="h-8 px-2"
          >
            {safeCurrent < totalPages ? (
              <Link href={buildHref({ page: safeCurrent + 1 })}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      )}
    </nav>
  )
}

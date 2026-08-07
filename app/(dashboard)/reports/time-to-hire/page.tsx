import { getTranslations } from 'next-intl/server'
import { getTimeToHireReport } from '@/lib/reports/queries'
import { parsePeriod, PERIOD_I18N_KEY } from '@/lib/reports/period'
import { formatDays } from '@/lib/reports/time-to-hire'
import { PeriodSelector } from '@/components/reports/period-selector'
import { SummaryStat } from '@/components/reports/summary-stat'
import { ReportEmpty } from '@/components/reports/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SearchParams = Promise<{ period?: string }>

export default async function TimeToHirePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const report = await getTimeToHireReport(period)
  const t = await getTranslations()

  if (!report) {
    return <ReportEmpty message={t('reports.loadError')} />
  }

  const { stats, byVacancy } = report

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('reports.tab.timeToHire')} · {t(PERIOD_I18N_KEY[period])}</h2>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label={t('reports.hires')} value={stats.count} />
        <SummaryStat label={t('reports.median')} value={formatDays(stats.median)} />
        <SummaryStat label={t('reports.p25p75')} value={`${formatDays(stats.p25)} – ${formatDays(stats.p75)}`} />
        <SummaryStat label={t('reports.mean')} value={formatDays(stats.mean)} />
      </div>

      {stats.count === 0 ? (
        <ReportEmpty message={t('reports.emptyHires')} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">{t('reports.byVacancy')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t('reports.vacancy')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.hires')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.medianTimeToHire')}</th>
                </tr>
              </thead>
              <tbody>
                {byVacancy.map((row) => (
                  <tr key={row.vacancyId} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{row.vacancyTitle}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatDays(row.median)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

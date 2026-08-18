import { getTranslations } from 'next-intl/server'
import { getPipelineReport } from '@/lib/reports/queries'
import { parsePeriod, PERIOD_I18N_KEY } from '@/lib/reports/period'
import { FUNNEL_STAGES, FUNNEL_STAGE_I18N_KEY, stageConversion } from '@/lib/reports/funnel'
import { PeriodSelector } from '@/components/reports/period-selector'
import { SummaryStat } from '@/components/reports/summary-stat'
import { ReportEmpty } from '@/components/reports/empty-state'
import { FunnelChart } from '@/components/reports/funnel-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SearchParams = Promise<{ period?: string }>

export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const report = await getPipelineReport(period)
  const t = await getTranslations()

  if (!report) {
    return <ReportEmpty message={t('reports.loadError')} />
  }

  const { funnel } = report

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('reports.pipelineConversion')} · {t(PERIOD_I18N_KEY[period])}</h2>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label={t('reports.applications')} value={funnel.applied} />
        <SummaryStat
          label={t('reports.reachedInterview')}
          value={funnel.interview}
          hint={formatRate(stageConversion(funnel.applied, funnel.interview))}
        />
        <SummaryStat
          label={t('reports.stage.hired')}
          value={funnel.hired}
          hint={formatRate(stageConversion(funnel.applied, funnel.hired))}
        />
        <SummaryStat
          label={t('reports.rejectedWithdrawn')}
          value={funnel.rejected + funnel.withdrawn}
          hint={t('reports.rejWdHint', { rej: funnel.rejected, wd: funnel.withdrawn })}
        />
      </div>

      {funnel.total === 0 ? (
        <ReportEmpty message={t('reports.emptyApplications')} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t('reports.funnel')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart data={funnel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t('reports.stageToStage')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">{t('reports.from')}</th>
                    <th className="px-4 py-2 text-left">{t('reports.to')}</th>
                    <th className="px-4 py-2 text-right">{t('reports.reached')}</th>
                    <th className="px-4 py-2 text-right">{t('reports.conversion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNNEL_STAGES.slice(1).map((stage, idx) => {
                    const previous = FUNNEL_STAGES[idx]
                    if (!previous) return null
                    const fromCount = funnel[previous]
                    const toCount = funnel[stage]
                    const conv = stageConversion(fromCount, toCount)
                    return (
                      <tr key={stage} className="border-b last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">{t(FUNNEL_STAGE_I18N_KEY[previous])}</td>
                        <td className="px-4 py-2 font-medium">{t(FUNNEL_STAGE_I18N_KEY[stage])}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{toCount}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatRate(conv)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

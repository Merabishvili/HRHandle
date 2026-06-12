import { getPipelineReport } from '@/lib/reports/queries'
import { parsePeriod, PERIOD_LABELS } from '@/lib/reports/period'
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS, stageConversion } from '@/lib/reports/funnel'
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

  if (!report) {
    return <ReportEmpty message="Could not load report." />
  }

  const { funnel } = report

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Pipeline conversion · {PERIOD_LABELS[period]}</h2>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Applications" value={funnel.applied} />
        <SummaryStat
          label="Reached interview"
          value={funnel.interview}
          hint={formatRate(stageConversion(funnel.applied, funnel.interview))}
        />
        <SummaryStat
          label="Hired"
          value={funnel.hired}
          hint={formatRate(stageConversion(funnel.applied, funnel.hired))}
        />
        <SummaryStat
          label="Rejected / withdrawn"
          value={funnel.rejected + funnel.withdrawn}
          hint={`${funnel.rejected} rej · ${funnel.withdrawn} wd`}
        />
      </div>

      {funnel.total === 0 ? (
        <ReportEmpty message="No applications in this period yet. Try a wider range." />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart data={funnel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Stage-to-stage conversion</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">From</th>
                    <th className="px-4 py-2 text-left">To</th>
                    <th className="px-4 py-2 text-right">Reached</th>
                    <th className="px-4 py-2 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNNEL_STAGES.slice(1).map((stage, idx) => {
                    const previous = FUNNEL_STAGES[idx]
                    const fromCount = funnel[previous]
                    const toCount = funnel[stage]
                    const conv = stageConversion(fromCount, toCount)
                    return (
                      <tr key={stage} className="border-b last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">{FUNNEL_STAGE_LABELS[previous]}</td>
                        <td className="px-4 py-2 font-medium">{FUNNEL_STAGE_LABELS[stage]}</td>
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

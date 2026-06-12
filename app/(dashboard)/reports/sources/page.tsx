import { getSourceReport } from '@/lib/reports/queries'
import { parsePeriod, PERIOD_LABELS } from '@/lib/reports/period'
import { formatPercent } from '@/lib/reports/source-summary'
import { PeriodSelector } from '@/components/reports/period-selector'
import { SummaryStat } from '@/components/reports/summary-stat'
import { ReportEmpty } from '@/components/reports/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SearchParams = Promise<{ period?: string }>

export default async function SourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const report = await getSourceReport(period)

  if (!report) {
    return <ReportEmpty message="Could not load report." />
  }

  const { rows, totalApplications, totalHires } = report
  const overallConversion = totalApplications === 0 ? null : totalHires / totalApplications

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Source effectiveness · {PERIOD_LABELS[period]}</h2>
        <PeriodSelector current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryStat label="Applications" value={totalApplications} />
        <SummaryStat label="Hires" value={totalHires} />
        <SummaryStat label="Overall conversion" value={formatPercent(overallConversion)} />
      </div>

      {rows.length === 0 ? (
        <ReportEmpty message="No applications in this period yet. Try a wider range." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">By source</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-right">Applications</th>
                  <th className="px-4 py-2 text-right">Hires</th>
                  <th className="px-4 py-2 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{row.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.applications}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.hires}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPercent(row.conversion)}</td>
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

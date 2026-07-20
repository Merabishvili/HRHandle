import { getSourceReport } from '@/lib/reports/queries'
import { parsePeriod, PERIOD_LABELS } from '@/lib/reports/period'
import { formatPercent } from '@/lib/reports/source-summary'
import { PeriodSelector } from '@/components/reports/period-selector'
import { SummaryStat } from '@/components/reports/summary-stat'
import { ReportEmpty } from '@/components/reports/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Wave 2.10 — per-source bar hues per `Reports and Interviews.dc.html` §2.
// Each source gets a deterministic tint so the rows scan as distinct
// without needing a legend. Falls back to brand-blue for any row past
// the palette length.
const SOURCE_HUES = [
  'oklch(0.55 0.18 250)', // brand blue
  'oklch(0.65 0.13 200)', // teal
  'oklch(0.7 0.13 145)',  // green
  'oklch(0.7 0.15 70)',   // amber
  'oklch(0.65 0.15 300)', // purple
  'oklch(0.7 0.15 25)',   // coral
] as const

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
        <>
          {/* Horizontal bars — applications per source, width-scaled to the
              top row. Hires count rendered next to applications so a high-
              volume / low-conversion source pops visually. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Sources · where hires come from</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {rows.map((row, idx) => {
                  const maxApps = Math.max(rows[0]?.applications ?? 1, 1)
                  const widthPct = Math.max(2, Math.round((row.applications / maxApps) * 100))
                  const hue = SOURCE_HUES[idx % SOURCE_HUES.length]
                  return (
                    <div key={row.key}>
                      <div className="mb-1 flex justify-between text-[12.5px]">
                        <span className="font-semibold text-foreground/85">{row.label}</span>
                        <span className="text-muted-foreground">
                          {row.applications} applied · {row.hires} hired
                        </span>
                      </div>
                      <div className="h-[9px] overflow-hidden rounded-full bg-[oklch(0.94_0.01_250)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${widthPct}%`, background: hue }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">By source</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
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
        </>
      )}
    </div>
  )
}

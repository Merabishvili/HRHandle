'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS, type FunnelCounts, stageConversion } from '@/lib/reports/funnel'

interface FunnelChartProps {
  data: FunnelCounts
}

export function FunnelChart({ data }: FunnelChartProps) {
  const rows = FUNNEL_STAGES.map((stage, idx) => {
    const count = data[stage]
    const previous = idx === 0 ? null : data[FUNNEL_STAGES[idx - 1]]
    const conv = previous === null ? null : stageConversion(previous, count)
    return {
      stage,
      label: FUNNEL_STAGE_LABELS[stage],
      count,
      conv: conv === null ? null : Math.round(conv * 100),
    }
  })

  return (
    <div className="w-full" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 16, right: 32, left: 16, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12 }}
            width={90}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value) => [value as number, 'Applications']}
            labelFormatter={(label) => label as string}
            contentStyle={{ borderRadius: 6, fontSize: 12 }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="count"
              position="right"
              className="fill-foreground"
              style={{ fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

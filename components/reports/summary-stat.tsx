import { Card, CardContent } from '@/components/ui/card'

interface SummaryStatProps {
  label: string
  value: string | number
  hint?: string
}

export function SummaryStat({ label, value, hint }: SummaryStatProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

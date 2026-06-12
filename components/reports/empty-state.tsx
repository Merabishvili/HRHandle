import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export function ReportEmpty({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

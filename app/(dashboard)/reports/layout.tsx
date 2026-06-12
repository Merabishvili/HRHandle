import { ReportsTabs } from './reports-tabs'

export const metadata = {
  title: 'Reports — HRHandle',
}

const TABS = [
  { href: '/reports/pipeline', label: 'Pipeline' },
  { href: '/reports/time-to-hire', label: 'Time to hire' },
  { href: '/reports/sources', label: 'Sources' },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline conversion, time-to-hire, and source effectiveness across your organisation.
        </p>
      </div>
      <ReportsTabs tabs={TABS} />
      {children}
    </div>
  )
}

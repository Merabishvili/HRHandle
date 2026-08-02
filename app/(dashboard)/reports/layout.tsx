import { getTranslations } from 'next-intl/server'
import { ReportsTabs } from './reports-tabs'

export const metadata = {
  title: 'Reports — HRHandle',
}

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations()
  const tabs = [
    { href: '/reports/pipeline', label: t('reports.tab.pipeline') },
    { href: '/reports/time-to-hire', label: t('reports.tab.timeToHire') },
    { href: '/reports/sources', label: t('reports.tab.sources') },
  ]
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('reports.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('reports.subtitle')}
        </p>
      </div>
      <ReportsTabs tabs={tabs} />
      {children}
    </div>
  )
}

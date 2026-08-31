'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'

export function ImportHeader({ subtitle, showBack = true }: { subtitle: string; showBack?: boolean }) {
  const t = useTranslations()
  return (
    <div>
      {showBack && (
        <Link
          href="/candidates"
          className="mb-3.5 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('csvImport.backToList')}
        </Link>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('csvImport.pageTitle')}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

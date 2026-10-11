import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { LanguageSwitcher } from '@/components/landing/language-switcher'
import type { Locale } from '@/lib/i18n/locales'

interface GuideShellProps {
  locale: Locale
  children: React.ReactNode
}

export async function GuideShell({ locale, children }: GuideShellProps) {
  const t = await getTranslations({ locale, namespace: 'guide' })
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/guide" className="text-sm font-semibold text-foreground">
            {t('shellTitle')}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('backToHome')}
            </Link>
            <LanguageSwitcher current={locale} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  )
}

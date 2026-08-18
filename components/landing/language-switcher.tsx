'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Public landing-page language switcher (§3b). No session/org yet, so it just
 * writes the visitor's choice to the NEXT_LOCALE cookie (which i18n/request.ts
 * reads) and refreshes. Default is always English; the choice persists across
 * visits and pre-fills a new account's UI language on sign-up.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()

  const choose = (locale: Locale) => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`
    startTransition(() => router.refresh())
  }

  const active = LOCALES.includes(current) ? current : DEFAULT_LOCALE

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        aria-label={t('langSwitch.aria')}
      >
        <span className="uppercase">{active}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => choose(locale)}
            className={locale === active ? 'font-semibold' : undefined}
          >
            <span className="mr-2 text-xs uppercase text-muted-foreground">{locale}</span>
            {LOCALE_LABELS[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

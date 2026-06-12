'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface ReportsTabsProps {
  tabs: { href: string; label: string }[]
}

export function ReportsTabs({ tabs }: ReportsTabsProps) {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

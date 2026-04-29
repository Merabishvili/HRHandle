'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'

export interface PillTab {
  value: string
  label: string
}

interface FilterPillTabsProps {
  tabs: PillTab[]
  paramKey: string
  activeValue: string
}

export function FilterPillTabs({ tabs, paramKey, activeValue }: FilterPillTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' || value === '') {
      params.delete(paramKey)
    } else {
      params.set(paramKey, value)
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="flex gap-1 rounded-[10px] bg-muted p-1 w-fit">
      {tabs.map((tab) => {
        const isActive =
          tab.value === activeValue ||
          (tab.value === 'all' && (!activeValue || activeValue === ''))
        return (
          <button
            key={tab.value}
            onClick={() => handleChange(tab.value)}
            className={cn(
              'px-3.5 py-1 rounded-lg text-xs font-medium transition-all',
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

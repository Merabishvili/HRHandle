'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PERIODS, PERIOD_I18N_KEY, type Period } from '@/lib/reports/period'

export function PeriodSelector({ current }: { current: Period }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '30d') {
      params.delete('period')
    } else {
      params.set('period', value)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p} value={p}>
            {t(PERIOD_I18N_KEY[p])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

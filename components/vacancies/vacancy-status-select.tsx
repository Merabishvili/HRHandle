'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronDown } from 'lucide-react'
import { updateVacancyStatus } from '@/lib/actions/vacancies'
import { useCloseVacancy } from '@/components/vacancies/use-close-vacancy'
import { VACANCY_STATUS_COLORS } from '@/lib/types/vacancy'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusOption {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
}

interface VacancyStatusSelectProps {
  vacancyId: string
  current: StatusOption
  options: StatusOption[]
}

export function VacancyStatusSelect({ vacancyId, current, options }: VacancyStatusSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations()
  const [isPending, setIsPending] = useState(false)
  const [activeStatus, setActiveStatus] = useState(current)

  // Localize the status by code (matches the list page); fall back to the
  // stored DB name for any code without a translation.
  const statusLabel = (o: StatusOption) =>
    t.has(`vacStatus.${o.code}`) ? t(`vacStatus.${o.code}`) : o.name

  // Closing / archiving asks first when candidates are still in progress;
  // "Close and reject" then opens "Reject remaining candidates" on this page.
  const { requestClose, closeDialog } = useCloseVacancy({
    onRejectNext: () => {
      const next = new URLSearchParams(searchParams.toString())
      next.set('rejectRemaining', '1')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
  })

  async function handleSelect(option: StatusOption) {
    if (option.id === activeStatus.id) return
    setIsPending(true)
    if (option.code === 'closed' || option.code === 'archived') {
      await requestClose({
        vacancyId,
        statusId: option.id,
        action: option.code === 'archived' ? 'archive' : 'close',
        onDone: (changed) => {
          if (changed) setActiveStatus(option)
        },
      })
      setIsPending(false)
      return
    }
    setActiveStatus(option)
    const result = await updateVacancyStatus(vacancyId, option.id)
    if (!result.success) {
      setActiveStatus(current)
    } else {
      router.refresh()
    }
    setIsPending(false)
  }

  return (
    <>
    {closeDialog}
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button className="inline-flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Badge
            variant="secondary"
            className={cn(VACANCY_STATUS_COLORS[activeStatus.code], 'cursor-pointer select-none pr-1.5')}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            {statusLabel(activeStatus)}
            <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => handleSelect(option)}
            className="gap-2"
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                option.code === 'open' && 'bg-green-500',
                option.code === 'draft' && 'bg-gray-400',
                option.code === 'on_hold' && 'bg-yellow-500',
                option.code === 'closed' && 'bg-red-500',
                option.code === 'archived' && 'bg-zinc-400',
              )}
            />
            {statusLabel(option)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}

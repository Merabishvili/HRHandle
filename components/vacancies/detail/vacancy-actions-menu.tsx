'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MoreHorizontal } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { DuplicateVacancyButton } from '@/components/vacancies/duplicate-vacancy-button'
import { DeleteVacancyButton } from '@/components/vacancies/delete-vacancy-button'

/**
 * The ⋯ actions menu (Edit / Duplicate / Delete) for the vacancy header.
 * Split into its own client component because the header
 * (`VacancyHeader`) is an async server component, and `DropdownMenuItem`'s
 * `onSelect` handler is an event handler that can't be passed across the
 * server→client boundary ("Event handlers cannot be passed to Client Component
 * props"). The `onSelect={preventDefault}` keeps the menu open so the nested
 * button's own click reliably fires.
 */
export function VacancyActionsMenu({
  vacancyId,
  title,
}: {
  vacancyId: string
  title: string
}) {
  const t = useTranslations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label={t('profile.moreActions')}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={`/vacancies/${vacancyId}/edit`}>{t('vacancies.editVacancy')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* preventDefault keeps the menu open so the nested button's own click
            reliably fires (and its loading/error state is visible). The buttons
            render icon-less + full-width so they read as plain menu items. */}
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent" onSelect={(e) => e.preventDefault()}>
          <div className="w-full"><DuplicateVacancyButton vacancyId={vacancyId} /></div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent" onSelect={(e) => e.preventDefault()}>
          <div className="w-full"><DeleteVacancyButton vacancyId={vacancyId} vacancyTitle={title} menuItem /></div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { duplicateVacancy } from '@/lib/actions/vacancies'

/** Rendered as a plain (icon-less) menu item inside the vacancy ⋯ menu. */
export function DuplicateVacancyButton({ vacancyId }: { vacancyId: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleDuplicate = async () => {
    setIsPending(true)
    const result = await duplicateVacancy(vacancyId)
    if (result.success) {
      router.push(`/vacancies/${result.data.id}/edit?duplicated=true`)
    } else {
      // Previously this failed silently — the button looked like it did
      // nothing when the real cause was usually a plan/vacancy limit on
      // trial. Surface the reason so it's never a dead click.
      toast.error(result.error || t('vacancies.duplicateFailed'))
      setIsPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={handleDuplicate}
      disabled={isPending}
      className="h-auto w-full justify-start px-2 py-1.5 font-normal"
    >
      {isPending ? t('vacancies.duplicating') : t('vacancies.duplicate')}
    </Button>
  )
}

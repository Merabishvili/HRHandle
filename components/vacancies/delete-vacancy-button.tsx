'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteVacancy } from '@/lib/actions/vacancies'

export function DeleteVacancyButton({
  vacancyId,
  vacancyTitle,
  menuItem = false,
}: {
  vacancyId: string
  vacancyTitle: string
  /** Render as a plain (icon-less) menu item for the vacancy ⋯ menu; otherwise
   * a standalone outline button (Settings tab). */
  menuItem?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleDelete = async () => {
    setIsPending(true)
    const result = await deleteVacancy(vacancyId)
    if (result.success) {
      toast.success(t('delVac.deleted', { title: vacancyTitle }))
      router.push('/vacancies')
    } else {
      toast.error(result.error)
      setIsPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {menuItem ? (
          <Button
            variant="ghost"
            disabled={isPending}
            className="h-auto w-full justify-start px-2 py-1.5 font-normal text-destructive hover:text-destructive"
          >
            {t('common.delete')}
          </Button>
        ) : (
          <Button variant="outline" disabled={isPending} className="text-destructive hover:text-destructive">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {t('common.delete')}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delVac.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich('delVac.confirmBody', { title: vacancyTitle, b: (c) => <strong>{c}</strong> })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? t('offer.deleting') : t('delVac.confirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

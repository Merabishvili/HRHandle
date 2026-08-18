'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { History, Loader2, Undo2 } from 'lucide-react'
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
} from '@/components/ui/alert-dialog'
import { splitMerge, type RecentMergeInfo } from '@/lib/actions/candidate-merge'

interface Props {
  info: RecentMergeInfo
}

/**
 * A-3b — Banner shown on the candidate profile when this candidate is
 * the surviving record of a merge that's still inside the 30-day
 * split-back window. Lets owners/admins reverse the merge (restores
 * the loser candidate row; merged-in child rows stay on the winner —
 * called out in the confirm dialog).
 */
export function RecentMergeBanner({ info }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSplit = () => {
    startTransition(async () => {
      const result = await splitMerge(info.mergeId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(t('mergeBanner.restored', { name: info.loserName }))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <section
        className="flex flex-wrap items-center gap-3 rounded-xl border border-[oklch(0.88_0.05_250)] bg-[oklch(0.985_0.012_250)] px-4 py-2.5"
        aria-label={t('mergeBanner.aria')}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[oklch(0.93_0.05_250)] text-[oklch(0.42_0.16_250)]">
          <History className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="text-[12.5px] text-foreground">
          <strong className="font-semibold">{t('mergeBanner.mergedWith', { name: info.loserName })}</strong>
          {info.mergedByName ? t('mergeBanner.by', { name: info.mergedByName }) : ''} ·{' '}
          {info.daysAgo === 0
            ? t('mergeBanner.today')
            : info.daysAgo === 1
              ? t('mergeBanner.yesterday')
              : t('mergeBanner.daysAgo', { count: info.daysAgo })} ·{' '}
          <span className="text-muted-foreground">{t('mergeBanner.daysLeft', { count: info.daysRemaining })}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7 gap-1.5 text-xs"
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          <Undo2 className="h-3 w-3" aria-hidden />
          {t('mergeBanner.splitBack')}
        </Button>
      </section>

      <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mergeBanner.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {t.rich('mergeBanner.confirmBody1', {
                    name: info.loserName,
                    b: (c) => <strong>{c}</strong>,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t.rich('mergeBanner.confirmBody2', { b: (c) => <strong>{c}</strong> })}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSplit()
              }}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t('mergeBanner.splitting')}
                </>
              ) : (
                t('mergeBanner.splitBack')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

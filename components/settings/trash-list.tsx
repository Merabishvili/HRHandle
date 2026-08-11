'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Loader2,
  RotateCcw,
  Trash2,
  Briefcase,
  UserCircle,
  CalendarClock,
} from 'lucide-react'

import { toDisplayFullName } from '@/lib/format-name'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

import {
  restoreCandidate,
  restoreVacancy,
  hardDeleteCandidate,
  hardDeleteVacancy,
  type TrashedCandidate,
  type TrashedVacancy,
} from '@/lib/actions/restore'
import { daysUntilPurge } from '@/lib/trash/impact'

type Item =
  | { kind: 'candidate'; data: TrashedCandidate }
  | { kind: 'vacancy'; data: TrashedVacancy }

interface TrashListProps {
  candidates: TrashedCandidate[]
  vacancies: TrashedVacancy[]
}

type Tab = 'candidates' | 'vacancies'

export function TrashList({ candidates, vacancies }: TrashListProps) {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>('candidates')
  const [confirmHardDelete, setConfirmHardDelete] = useState<Item | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleRestore = (item: Item) => {
    startTransition(async () => {
      if (item.kind === 'candidate') {
        const result = await restoreCandidate(item.data.id)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        const apps = result.data.restoredApplications
        const appsSuffix = apps === 0 ? '' : t('trash.appsToo', { count: apps })
        toast.success(t('trash.restoredCandidate', { name: toDisplayFullName(item.data.first_name, item.data.last_name), apps: appsSuffix }))
      } else {
        const result = await restoreVacancy(item.data.id)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        toast.success(t('trash.restoredVacancy', { title: item.data.title }))
      }
      router.refresh()
    })
  }

  const handleHardDelete = () => {
    const item = confirmHardDelete
    if (!item) return
    startTransition(async () => {
      const result =
        item.kind === 'candidate'
          ? await hardDeleteCandidate(item.data.id)
          : await hardDeleteVacancy(item.data.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        item.kind === 'candidate'
          ? t('trash.candidateDeleted', { name: toDisplayFullName(item.data.first_name, item.data.last_name) })
          : t('trash.vacancyDeleted', { title: item.data.title }),
      )
      setConfirmHardDelete(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border">
        <div className="flex gap-0">
          <TabButton active={tab === 'candidates'} onClick={() => setTab('candidates')}>
            {t('nav.candidates')}
            <Badge variant="secondary" className="ml-2 h-5 text-[10px]">
              {candidates.length}
            </Badge>
          </TabButton>
          <TabButton active={tab === 'vacancies'} onClick={() => setTab('vacancies')}>
            {t('nav.vacancies')}
            <Badge variant="secondary" className="ml-2 h-5 text-[10px]">
              {vacancies.length}
            </Badge>
          </TabButton>
        </div>
      </div>

      {tab === 'candidates' && (
        <CandidatesPanel
          rows={candidates}
          isPending={isPending}
          onRestore={(c) => handleRestore({ kind: 'candidate', data: c })}
          onHardDelete={(c) => setConfirmHardDelete({ kind: 'candidate', data: c })}
        />
      )}

      {tab === 'vacancies' && (
        <VacanciesPanel
          rows={vacancies}
          isPending={isPending}
          onRestore={(v) => handleRestore({ kind: 'vacancy', data: v })}
          onHardDelete={(v) => setConfirmHardDelete({ kind: 'vacancy', data: v })}
        />
      )}

      <AlertDialog
        open={!!confirmHardDelete}
        onOpenChange={(o) => !o && setConfirmHardDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('trash.deletePermTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmHardDelete?.kind === 'candidate' ? (
                t.rich('trash.candidateDeleteDesc', {
                  name: toDisplayFullName(confirmHardDelete.data.first_name, confirmHardDelete.data.last_name),
                  b: (c) => <strong>{c}</strong>,
                })
              ) : confirmHardDelete?.kind === 'vacancy' ? (
                t.rich('trash.vacancyDeleteDesc', {
                  title: confirmHardDelete.data.title,
                  b: (c) => <strong>{c}</strong>,
                })
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t('offer.deleting') : t('trash.deletePerm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        '-mb-px flex items-center px-4 py-2.5 text-sm border-b-2 transition-colors',
        active
          ? 'border-primary text-foreground font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CandidatesPanel({
  rows,
  isPending,
  onRestore,
  onHardDelete,
}: {
  rows: TrashedCandidate[]
  isPending: boolean
  onRestore: (c: TrashedCandidate) => void
  onHardDelete: (c: TrashedCandidate) => void
}) {
  const t = useTranslations()
  if (rows.length === 0) {
    return <EmptyState icon={<UserCircle className="h-10 w-10 text-muted-foreground/40" />} label={t('trash.noCandidates')} />
  }
  return (
    <ul className="space-y-2">
      {rows.map((c) => {
        const remaining = daysUntilPurge(c.deleted_at)
        return (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {toDisplayFullName(c.first_name, c.last_name)}
              </p>
              <p className="text-xs text-muted-foreground">
                {c.email ?? '—'} ·{' '}
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> {t('trash.deletedOn', { date: format(new Date(c.deleted_at), 'MMM d, yyyy') })}
                </span>
              </p>
              {c.cascadedApplicationIds.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('trash.restoringBrings', { count: c.cascadedApplicationIds.length })}
                </p>
              )}
            </div>
            <PurgeBadge days={remaining} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestore(c)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('trash.restore')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onHardDelete(c)}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t('trash.deleteNow')}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function VacanciesPanel({
  rows,
  isPending,
  onRestore,
  onHardDelete,
}: {
  rows: TrashedVacancy[]
  isPending: boolean
  onRestore: (v: TrashedVacancy) => void
  onHardDelete: (v: TrashedVacancy) => void
}) {
  const t = useTranslations()
  if (rows.length === 0) {
    return <EmptyState icon={<Briefcase className="h-10 w-10 text-muted-foreground/40" />} label={t('trash.noVacancies')} />
  }
  return (
    <ul className="space-y-2">
      {rows.map((v) => {
        const remaining = daysUntilPurge(v.deleted_at)
        return (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{v.title}</p>
              <p className="text-xs text-muted-foreground">
                {[v.department, v.location].filter(Boolean).join(' · ') || '—'} ·{' '}
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> {t('trash.deletedOn', { date: format(new Date(v.deleted_at), 'MMM d, yyyy') })}
                </span>
              </p>
            </div>
            <PurgeBadge days={remaining} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestore(v)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('trash.restore')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onHardDelete(v)}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t('trash.deleteNow')}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  const t = useTranslations()
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      {icon}
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('trash.emptyHint')}
      </p>
    </div>
  )
}

function PurgeBadge({ days }: { days: number }) {
  const t = useTranslations()
  if (days === 0) {
    return (
      <Badge variant="secondary" className="bg-rose-100 text-rose-900">
        {t('trash.purgeImminent')}
      </Badge>
    )
  }
  if (days <= 7) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900">
        {t('trash.daysLeft', { count: days })}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
      {t('trash.daysLeft', { count: days })}
    </Badge>
  )
}

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Calendar, Mail, XCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateApplicationStatus, updateApplicationPipelineStage } from '@/lib/actions/applications'
import { markApplicationHired } from '@/lib/actions/applications/status-actions'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'

interface RailActionsProps {
  applicationId: string
  candidateId: string
  /** Candidate email — pre-fills the "Email" mailto recipient. */
  candidateEmail: string | null
  /** Next non-terminal stage the candidate should advance to (used as the
   * primary action's label and target). Null when the current stage is
   * already the last active stage. */
  nextStage: { code: ApplicationStatus['code']; name: string; id: string } | null
  /** When true, `nextStage.id` is a per-vacancy pipeline_stage id (advance via
   * updateApplicationPipelineStage); when false it's a canonical status id
   * (advance via updateApplicationStatus). */
  advanceUsesPipelineStage: boolean
  /** Trigger the existing rejection-dialog flow scoped to this
   * application. Held by the parent so the dialog can render at the page
   * level. */
  onReject: () => void
}

/**
 * Wave 2.3 right-rail ACTIONS section per Candidate Profile A Refined.dc.html.
 *
 * Primary "Advance to {next} →" brand-blue button + the Schedule / Email /
 * Reject trio below. Renders against the currently-selected application —
 * the buttons are stage-aware.
 */
export function RailActions({
  applicationId,
  candidateId,
  candidateEmail,
  nextStage,
  advanceUsesPipelineStage,
  onReject,
}: RailActionsProps) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const nextStageLabel = nextStage ? pipelineStageLabel(t, nextStage.name) : ''

  const advance = () => {
    if (!nextStage) return
    startTransition(async () => {
      const result = advanceUsesPipelineStage
        ? await updateApplicationPipelineStage(applicationId, nextStage.id)
        : await updateApplicationStatus(applicationId, nextStage.id)
      if (!result.success) {
        toast.error(t('rail.advanceFailed'))
        return
      }
      toast.success(t('rail.advancedTo', { name: nextStageLabel }))
      router.refresh()
    })
  }

  // At the last active stage there's no "next stage" to advance to — the
  // meaningful next move is hiring. Offer it here instead of a dead
  // "final stage" message (works from Offer without waiting on acceptance).
  const hire = () => {
    startTransition(async () => {
      const result = await markApplicationHired(applicationId)
      if (!result.success) {
        toast.error(t('rail.advanceFailed'))
        return
      }
      toast.success(t('stageBlock.markedHired'))
      router.refresh()
    })
  }

  return (
    <section aria-label={t('rail.actions')} className="space-y-2.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {t('rail.actions')}
      </p>

      {nextStage ? (
        <Button
          onClick={advance}
          disabled={pending}
          className="w-full gap-1.5 rounded-[9px] bg-[oklch(0.55_0.18_250)] py-2.5 text-[13px] font-bold text-white hover:bg-[oklch(0.5_0.18_250)]"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('rail.advanceTo', { name: nextStageLabel })}
        </Button>
      ) : (
        <Button
          onClick={hire}
          disabled={pending}
          className="w-full gap-1.5 rounded-[9px] bg-[oklch(0.55_0.16_150)] py-2.5 text-[13px] font-bold text-white hover:bg-[oklch(0.5_0.16_150)]"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('stageBlock.markHired')}
        </Button>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <SecondaryRailButton href={`/interviews/new?candidate=${candidateId}&application=${applicationId}`}>
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {t('rail.schedule')}
        </SecondaryRailButton>
        <SecondaryRailButton
          href={candidateEmail ? `mailto:${candidateEmail}` : 'mailto:'}
          disabled={!candidateEmail}
          title={candidateEmail ? undefined : t('rail.noEmailTitle')}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {t('candWizard.personal.email')}
        </SecondaryRailButton>
        <button
          type="button"
          onClick={onReject}
          disabled={pending}
          className={cn(
            'flex items-center justify-center gap-1 rounded-[9px] border border-[oklch(0.88_0.04_27)] py-2 text-[12px] font-semibold text-[oklch(0.5_0.19_27)] transition-colors hover:bg-[oklch(0.97_0.03_27)]',
          )}
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          {t('rail.reject')}
        </button>
      </div>
    </section>
  )
}

function SecondaryRailButton({
  href,
  children,
  disabled,
  title,
}: {
  href: string
  children: React.ReactNode
  disabled?: boolean | undefined
  title?: string | undefined
}) {
  const cls =
    'flex items-center justify-center gap-1 rounded-[9px] border border-[oklch(0.88_0.01_250)] py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted'
  if (disabled) {
    return (
      <span
        title={title}
        aria-disabled="true"
        className={cn(cls, 'cursor-not-allowed opacity-50 hover:bg-transparent')}
      >
        {children}
      </span>
    )
  }
  return (
    <Link href={href} title={title} className={cls}>
      {children}
    </Link>
  )
}

export interface RailDetailsItem {
  label: string
  value: React.ReactNode
}

interface RailDetailsProps {
  items: RailDetailsItem[]
}

/** Long string values (e.g. a comma-separated language list) wrap badly in a
 * label-left / value-right row, so those render stacked (label above, value
 * below) — matching the custom-fields display (#5/6/7). */
const STACK_VALUE_OVER = 24

export function RailDetails({ items }: RailDetailsProps) {
  const t = useTranslations()
  if (items.length === 0) return null
  return (
    // Styled to match the vacancy "Posting details" block (15px bold heading,
    // 12.5px label/value rows) per #6.
    <section aria-label={t('rail.details')} className="space-y-2.5">
      <h2 className="text-[15px] font-bold text-foreground">{t('rail.details')}</h2>
      <ul className="flex flex-col gap-2 text-[12.5px]">
        {items.map((item) => {
          const stacked = typeof item.value === 'string' && item.value.length > STACK_VALUE_OVER
          if (stacked) {
            return (
              <li key={item.label} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
                  {item.value}
                </span>
              </li>
            )
          }
          return (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="break-words text-right font-semibold text-foreground [overflow-wrap:anywhere]">
                {item.value}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}


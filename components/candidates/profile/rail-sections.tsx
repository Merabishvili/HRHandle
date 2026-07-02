'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Mail, XCircle, ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateApplicationStatus } from '@/lib/actions/applications'
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
  onReject,
}: RailActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const advance = () => {
    if (!nextStage) return
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, nextStage.id)
      if (!result.success) {
        toast.error('Failed to advance — try again.')
        return
      }
      toast.success(`Advanced to ${nextStage.name}.`)
      router.refresh()
    })
  }

  return (
    <section aria-label="Actions" className="space-y-2.5">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Actions
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
          Advance to {nextStage.name}
        </Button>
      ) : (
        <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2 text-center text-[12px] text-muted-foreground">
          Already at the final active stage.
        </p>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <SecondaryRailButton href={`/interviews/new?candidate=${candidateId}&application=${applicationId}`}>
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          Schedule
        </SecondaryRailButton>
        <SecondaryRailButton
          href={candidateEmail ? `mailto:${candidateEmail}` : 'mailto:'}
          disabled={!candidateEmail}
          title={candidateEmail ? undefined : 'No email on file for this candidate'}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Email
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
          Reject
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
  disabled?: boolean
  title?: string
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

export function RailDetails({ items }: RailDetailsProps) {
  if (items.length === 0) return null
  return (
    <section aria-label="Details" className="space-y-2">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Details
      </p>
      <ul className="flex flex-col gap-[7px] text-[12.5px]">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-right font-semibold text-foreground">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface RailCustomFieldsProps {
  items: { label: string; value: string | null }[]
}

export function RailCustomFields({ items }: RailCustomFieldsProps) {
  if (items.length === 0) return null
  return (
    <section aria-label="Custom fields" className="space-y-2">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Custom fields
      </p>
      <ul className="flex flex-col gap-[7px] text-[12.5px]">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-right font-semibold text-foreground">{item.value ?? '—'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
